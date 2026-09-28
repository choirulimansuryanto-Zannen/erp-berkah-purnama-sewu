import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { distributionSchema } from "@/lib/validations/warehouse";

export async function GET() {
  const { user, response } = await requirePermission("warehouse:manage");
  if (!user) return response!;

  const distributions = await prisma.stockDistribution.findMany({
    include: { product: true, outlet: true, requestedBy: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ distributions });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("warehouse:manage");
  if (!user) return response!;

  const parsed = distributionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const stock = await prisma.warehouseStock.findUnique({ where: { productId: parsed.data.productId } });
  if (!stock || stock.qtyOnHand < parsed.data.qty) {
    return NextResponse.json({ error: "Stok gudang tidak mencukupi" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const distribution = await tx.stockDistribution.create({
      data: { ...parsed.data, requestedById: user.id },
    });
    await tx.warehouseStock.update({
      where: { productId: parsed.data.productId },
      data: { qtyOnHand: { decrement: parsed.data.qty } },
    });
    return distribution;
  });

  return NextResponse.json({ success: true, distribution_id: result.id });
}
