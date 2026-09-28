import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, response } = await requirePermission("warehouse:manage");
  if (!user) return response!;

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: { warehouseStock: true },
    orderBy: { name: "asc" },
  });

  const stock = products.map((p) => ({
    productId: p.id,
    productName: p.name,
    sku: p.sku,
    qtyOnHand: p.warehouseStock?.qtyOnHand ?? 0,
    minLevel: p.warehouseStock?.minLevel ?? 0,
  }));

  return NextResponse.json({ stock });
}
