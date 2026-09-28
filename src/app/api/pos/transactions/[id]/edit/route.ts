import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { editTransactionSchema } from "@/lib/validations/pos";
import { calculatePointsEarned, redemptionValue, tierForAnnualSpend } from "@/lib/loyalty";
import { getBusinessSettings } from "@/lib/business-settings";

// "Edit" a completed transaction without ever mutating it in place — the
// same immutability principle the void endpoint follows (prd.md §"Key
// Design Principles"): void the original (reversal transaction, points
// reversed) and create a fresh corrected transaction, atomically. The user
// experiences this as "editing qty/product"; the ledger stays append-only.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("pos:void_transaction");
  if (!user) return response!;

  const parsed = editTransactionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const approver = await prisma.user.findUnique({ where: { id: input.approvalSpvId } });
  if (!approver || !["SPV", "MASTER_ADMIN"].includes(approver.role)) {
    return NextResponse.json({ error: "approvalSpvId must reference an SPV or Master Admin" }, { status: 400 });
  }

  const original = await prisma.transaction.findUnique({ where: { id }, include: { items: true } });
  if (!original) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (original.status === "VOIDED") {
    return NextResponse.json({ error: "Transaction already voided" }, { status: 409 });
  }

  const settings = await getBusinessSettings();
  const minutesSinceCreation = (Date.now() - original.createdAt.getTime()) / 1000 / 60;
  if (minutesSinceCreation > settings.voidWindowMinutes) {
    return NextResponse.json({ error: `Edit window (${settings.voidWindowMinutes} minutes) has expired` }, { status: 400 });
  }

  const products = await prisma.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) } } });
  if (products.length !== new Set(input.items.map((i) => i.productId)).size) {
    return NextResponse.json({ error: "One or more products not found" }, { status: 400 });
  }

  const toppingIds = [...new Set(input.items.flatMap((i) => i.toppings.map((t) => t.toppingId)))];
  const toppings = toppingIds.length ? await prisma.topping.findMany({ where: { id: { in: toppingIds } } }) : [];
  if (toppings.length !== toppingIds.length) {
    return NextResponse.json({ error: "One or more toppings not found" }, { status: 400 });
  }

  const subtotal = input.items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const toppingsTotal = item.toppings.reduce((s, t) => {
      const topping = toppings.find((tp) => tp.id === t.toppingId)!;
      return s + Number(topping.price) * t.qty;
    }, 0);
    return sum + Number(product.price) * item.qty + toppingsTotal * item.qty;
  }, 0);

  const member = input.memberId ? await prisma.member.findUnique({ where: { id: input.memberId } }) : null;
  if (input.memberId && !member) {
    return NextResponse.json({ error: "Member not found" }, { status: 400 });
  }

  let redemptionDiscount = 0;
  if (input.pointsToRedeem > 0) {
    if (!member) return NextResponse.json({ error: "pointsToRedeem requires memberId" }, { status: 400 });
    if (member.pointsBalance < input.pointsToRedeem) {
      return NextResponse.json({ error: "Insufficient points balance" }, { status: 400 });
    }
    redemptionDiscount = redemptionValue(input.pointsToRedeem, settings);
  }

  const total = Math.max(0, subtotal - input.discount - redemptionDiscount);
  const pointsEarned = member ? calculatePointsEarned(total, member.tier, settings) : 0;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Void the original (reversal transaction), same as the void endpoint.
    await tx.transaction.update({
      where: { id: original.id },
      data: { status: "VOIDED", voidReason: `Edited: ${input.reason}`, voidApprovedById: approver.id },
    });
    if (original.memberId) {
      await tx.member.update({
        where: { id: original.memberId },
        data: { pointsBalance: { increment: original.pointsRedeemed - original.pointsEarned } },
      });
    }
    await tx.transaction.create({
      data: {
        outletId: original.outletId,
        pramuniagaId: original.pramuniagaId,
        memberId: original.memberId,
        subtotal: original.subtotal.negated(),
        discount: original.discount.negated(),
        tax: original.tax.negated(),
        total: original.total.negated(),
        channel: original.channel,
        paymentMethod: original.paymentMethod,
        status: "VOIDED",
        voidReason: `Reversal of ${original.id} (edited): ${input.reason}`,
        voidApprovedById: approver.id,
        items: {
          create: original.items.map((item) => ({
            productId: item.productId,
            qty: -item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount,
          })),
        },
      },
    });

    // 2. Create the corrected transaction, same shape as a fresh checkout.
    const corrected = await tx.transaction.create({
      data: {
        outletId: original.outletId,
        pramuniagaId: original.pramuniagaId,
        memberId: member?.id,
        subtotal,
        discount: input.discount + redemptionDiscount,
        tax: 0,
        total,
        channel: input.channel,
        paymentMethod: input.paymentMethod,
        pointsEarned,
        pointsRedeemed: input.pointsToRedeem,
        status: "COMPLETED",
        // Editing doesn't re-verify voucherRedemptionId the way the create
        // route does (src/app/api/pos/transactions/route.ts) — the edit UI
        // only ever adjusts qty/product on a transaction's existing items,
        // it never creates a new voucher redemption, so a voucher-reward
        // line always re-prices at the product's normal price here.
        items: {
          create: input.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            return {
              productId: item.productId,
              qty: item.qty,
              unitPrice: product.price,
              discount: 0,
              toppings: item.toppings.length
                ? {
                    create: item.toppings.map((t) => {
                      const topping = toppings.find((tp) => tp.id === t.toppingId)!;
                      return { toppingId: t.toppingId, qty: t.qty * item.qty, unitPrice: topping.price };
                    }),
                  }
                : undefined,
            };
          }),
        },
      },
    });

    if (member) {
      await tx.memberTransaction.create({
        data: { memberId: member.id, transactionId: corrected.id, pointsEarned, pointsRedeemed: input.pointsToRedeem },
      });

      const annualSpendWindowMs = settings.memberAnnualSpendWindowDays * 24 * 60 * 60 * 1000;
      const annualSpendAgg = await tx.transaction.aggregate({
        where: { memberId: member.id, createdAt: { gte: new Date(Date.now() - annualSpendWindowMs) } },
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

    return corrected;
  });

  return NextResponse.json({ success: true, transaction_id: result.id });
}
