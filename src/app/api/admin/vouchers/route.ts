import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createVoucherSchema } from "@/lib/validations/vouchers";

export async function GET() {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const vouchers = await prisma.voucher.findMany({
    include: { rewardProduct: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ vouchers });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = createVoucherSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.voucher.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: "Kode voucher sudah digunakan" }, { status: 409 });
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.rewardProductId } });
  if (!product) {
    return NextResponse.json({ error: "Produk hadiah tidak ditemukan" }, { status: 400 });
  }

  const voucher = await prisma.voucher.create({
    data: { ...parsed.data, createdById: user.id },
  });

  return NextResponse.json({ voucher_id: voucher.id, success: true });
}
