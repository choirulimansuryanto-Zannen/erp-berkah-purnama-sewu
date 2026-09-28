import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createTransactionSchema } from "@/lib/validations/pos";
import { calculatePointsEarned, redemptionValue, tierForAnnualSpend } from "@/lib/loyalty";
import { getSessionTimeRange, startOfToday } from "@/lib/session";
import { getBusinessSettings } from "@/lib/business-settings";
import { isChannelAllowedForCategory } from "@/lib/channel-rules";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("pos:ring_up");
  if (!user || !user.outletId) return response!;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");

  // pos:ring_up is PRAMUNIAGA-only, so this list is always "my current
  // shift's transactions" — scoped to the open session's clock-time window
  // rather than the calendar day, so it doesn't reset at midnight mid-shift.
  const { from } = (await getSessionTimeRange(user.id)) ?? { from: startOfToday() };

  const transactions = await prisma.transaction.findMany({
    where: {
      outletId: user.outletId,
      createdAt: { gte: from },
      ...(scope === "mine" ? { pramuniagaId: user.id } : {}),
    },
    include: { items: { include: { product: true, toppings: { include: { topping: true } } } }, member: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ transactions });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("pos:ring_up");
  if (!user || !user.outletId) return response!;

  const parsed = createTransactionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const settings = await getBusinessSettings();

  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) } },
  });
  if (products.length !== new Set(input.items.map((i) => i.productId)).size) {
    return NextResponse.json({ error: "One or more products not found" }, { status: 400 });
  }

  // Some categories only ring up on certain channels (e.g. PAKET_ONLINE is
  // Grab/GoFood/Shopee only) — admin-editable at /admin/channel-rules. The
  // POS UI already filters the product grid by this, but it's re-checked
  // here since the UI filter alone doesn't stop a direct API call.
  const channelRules = await prisma.categoryChannelRule.findMany();
  for (const item of input.items) {
    const product = products.find((p) => p.id === item.productId)!;
    if (!isChannelAllowedForCategory(product.category, input.channel, channelRules)) {
      return NextResponse.json(
        { error: `${product.name} (${product.category}) tidak berlaku untuk channel ${input.channel}` },
        { status: 400 },
      );
    }
  }

  const toppingIds = [...new Set(input.items.flatMap((i) => i.toppings.map((t) => t.toppingId)))];
  const toppings = toppingIds.length
    ? await prisma.topping.findMany({ where: { id: { in: toppingIds } } })
    : [];
  if (toppings.length !== toppingIds.length) {
    return NextResponse.json({ error: "One or more toppings not found" }, { status: 400 });
  }

  // Voucher-reward lines are free — verified against a real
  // VoucherRedemption (created by /api/vouchers/redeem when the code was
  // entered), not trusted from the client. A redemption can only back one
  // transaction (transactionId is unique), so this also rejects any attempt
  // to reuse the same redemption across multiple checkouts.
  const voucherRedemptionIds = input.items.map((i) => i.voucherRedemptionId).filter((id): id is string => Boolean(id));
  const voucherRedemptions = voucherRedemptionIds.length
    ? await prisma.voucherRedemption.findMany({ where: { id: { in: voucherRedemptionIds } }, include: { voucher: true } })
    : [];
  for (const item of input.items) {
    if (!item.voucherRedemptionId) continue;
    const redemption = voucherRedemptions.find((r) => r.id === item.voucherRedemptionId);
    if (!redemption) {
      return NextResponse.json({ error: "Redeem voucher tidak ditemukan" }, { status: 400 });
    }
    if (redemption.transactionId) {
      return NextResponse.json({ error: "Voucher ini sudah dipakai di transaksi lain" }, { status: 400 });
    }
    if (redemption.voucher.rewardProductId !== item.productId) {
      return NextResponse.json({ error: "Item hadiah voucher tidak sesuai" }, { status: 400 });
    }
  }

  const subtotal = input.items.reduce((sum, item) => {
    if (item.voucherRedemptionId) return sum; // free — no topping charge either, matching a plain gift item
    const product = products.find((p) => p.id === item.productId)!;
    const toppingsTotal = item.toppings.reduce((s, t) => {
      const topping = toppings.find((tp) => tp.id === t.toppingId)!;
      return s + Number(topping.price) * t.qty;
    }, 0);
    return sum + Number(product.price) * item.qty + toppingsTotal * item.qty;
  }, 0);

  const discountThreshold = subtotal * (settings.posDiscountSpvThresholdPercent / 100);
  if (input.discount > discountThreshold && !input.approvedBySpvId) {
    return NextResponse.json(
      {
        error: `Discount above ${settings.posDiscountSpvThresholdPercent}% requires SPV approval (approvedBySpvId)`,
      },
      { status: 400 },
    );
  }
  if (input.approvedBySpvId) {
    const approver = await prisma.user.findUnique({ where: { id: input.approvedBySpvId } });
    if (!approver || !["SPV", "MASTER_ADMIN"].includes(approver.role)) {
      return NextResponse.json({ error: "approvedBySpvId must reference an SPV or Master Admin" }, { status: 400 });
    }
  }

  const member = input.memberId
    ? await prisma.member.findUnique({ where: { id: input.memberId } })
    : null;
  if (input.memberId && !member) {
    return NextResponse.json({ error: "Member not found" }, { status: 400 });
  }

  let redemptionDiscount = 0;
  if (input.pointsToRedeem > 0) {
    if (!member) {
      return NextResponse.json({ error: "pointsToRedeem requires memberId" }, { status: 400 });
    }
    if (member.pointsBalance < input.pointsToRedeem) {
      return NextResponse.json({ error: "Insufficient points balance" }, { status: 400 });
    }
    redemptionDiscount = redemptionValue(input.pointsToRedeem, settings);
  }

  const total = Math.max(0, subtotal - input.discount - redemptionDiscount);
  const pointsEarned = member ? calculatePointsEarned(total, member.tier, settings) : 0;

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        outletId: user.outletId!,
        pramuniagaId: user.id,
        memberId: member?.id,
        subtotal,
        discount: input.discount + redemptionDiscount,
        tax: 0,
        total,
        channel: input.channel,
        paymentMethod: input.paymentMethod,
        pointsEarned,
        pointsRedeemed: input.pointsToRedeem,
        deviceFingerprint: input.deviceFingerprint,
        items: {
          create: input.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            const isVoucherReward = Boolean(item.voucherRedemptionId);
            return {
              productId: item.productId,
              qty: item.qty,
              unitPrice: isVoucherReward ? 0 : product.price,
              discount: 0,
              toppings: !isVoucherReward && item.toppings.length
                ? {
                    create: item.toppings.map((t) => {
                      const topping = toppings.find((tp) => tp.id === t.toppingId)!;
                      // Store the actual total quantity of this topping consumed
                      // by the line (per-unit qty × how many product units are
                      // in the line), not just the per-unit recipe count.
                      return { toppingId: t.toppingId, qty: t.qty * item.qty, unitPrice: topping.price };
                    }),
                  }
                : undefined,
            };
          }),
        },
      },
      include: { items: { include: { toppings: true } } },
    });

    // Link each redeemed voucher to the transaction it ended up on, so a
    // redemption can't be reused (transactionId is unique) and can be
    // traced forward for reporting.
    for (const redemptionId of voucherRedemptionIds) {
      await tx.voucherRedemption.update({ where: { id: redemptionId }, data: { transactionId: transaction.id } });
    }

    if (member) {
      await tx.memberTransaction.create({
        data: {
          memberId: member.id,
          transactionId: transaction.id,
          pointsEarned,
          pointsRedeemed: input.pointsToRedeem,
        },
      });

      const annualSpendWindowMs = settings.memberAnnualSpendWindowDays * 24 * 60 * 60 * 1000;
      const annualSpendAgg = await tx.transaction.aggregate({
        where: {
          memberId: member.id,
          createdAt: { gte: new Date(Date.now() - annualSpendWindowMs) },
        },
        _sum: { total: true },
      });
      const annualSpend = Number(annualSpendAgg._sum.total ?? 0);

      await tx.member.update({
        where: { id: member.id },
        data: {
          pointsBalance: member.pointsBalance + pointsEarned - input.pointsToRedeem,
          tier: tierForAnnualSpend(annualSpend, settings),
        },
      });
    }

    return transaction;
  });

  return NextResponse.json({ transaction_id: result.id, success: true });
}
