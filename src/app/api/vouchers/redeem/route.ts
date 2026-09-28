import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { redeemVoucherSchema } from "@/lib/validations/vouchers";

// Redeems the moment a valid code is entered — not at checkout — the same
// way a physical voucher is "spent" as soon as it's handed over, whether or
// not the sale it was used on ultimately completes. See the schema comment
// on VoucherRedemption for how this ties back to the transaction later.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("pos:ring_up");
  if (!user || !user.outletId) return response!;

  const parsed = redeemVoucherSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const voucher = await prisma.voucher.findUnique({
    where: { code: parsed.data.code },
    include: { rewardProduct: true },
  });
  if (!voucher) {
    return NextResponse.json({ error: "Kode voucher tidak ditemukan" }, { status: 404 });
  }
  if (voucher.status !== "ACTIVE") {
    return NextResponse.json({ error: "Voucher tidak aktif" }, { status: 400 });
  }
  const now = new Date();
  if (voucher.validFrom && now < voucher.validFrom) {
    return NextResponse.json({ error: "Voucher belum berlaku" }, { status: 400 });
  }
  if (voucher.validUntil && now > voucher.validUntil) {
    return NextResponse.json({ error: "Voucher sudah kedaluwarsa" }, { status: 400 });
  }
  if (voucher.maxRedemptions !== null && voucher.redemptionCount >= voucher.maxRedemptions) {
    return NextResponse.json({ error: "Voucher sudah mencapai batas penggunaan" }, { status: 400 });
  }

  const redemption = await prisma.$transaction(async (tx) => {
    // Re-check the redemption cap inside the transaction to close the race
    // window between the check above and this write.
    const fresh = await tx.voucher.findUnique({ where: { id: voucher.id } });
    if (!fresh || fresh.status !== "ACTIVE" || (fresh.maxRedemptions !== null && fresh.redemptionCount >= fresh.maxRedemptions)) {
      throw new Error("VOUCHER_UNAVAILABLE");
    }
    await tx.voucher.update({ where: { id: voucher.id }, data: { redemptionCount: { increment: 1 } } });
    return tx.voucherRedemption.create({
      data: {
        voucherId: voucher.id,
        memberId: parsed.data.memberId,
        outletId: user.outletId!,
        redeemedById: user.id,
      },
    });
  }).catch((e) => {
    if (e instanceof Error && e.message === "VOUCHER_UNAVAILABLE") return null;
    throw e;
  });

  if (!redemption) {
    return NextResponse.json({ error: "Voucher sudah mencapai batas penggunaan" }, { status: 400 });
  }

  return NextResponse.json({
    redemption_id: redemption.id,
    product: { id: voucher.rewardProduct.id, name: voucher.rewardProduct.name, price: Number(voucher.rewardProduct.price) },
    qty: voucher.rewardQty,
  });
}
