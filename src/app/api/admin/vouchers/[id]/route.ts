import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { updateVoucherSchema } from "@/lib/validations/vouchers";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = updateVoucherSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.rewardProductId) {
    const product = await prisma.product.findUnique({ where: { id: parsed.data.rewardProductId } });
    if (!product) return NextResponse.json({ error: "Produk hadiah tidak ditemukan" }, { status: 400 });
  }

  const voucher = await prisma.voucher.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, voucher });
}
