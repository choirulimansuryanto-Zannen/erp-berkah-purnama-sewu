import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { receivingSchema } from "@/lib/validations/warehouse";

export async function GET() {
  const { user, response } = await requirePermission("warehouse:manage");
  if (!user) return response!;

  const receivings = await prisma.warehouseReceiving.findMany({
    include: { product: true, receivedBy: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ receivings });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("warehouse:manage");
  if (!user) return response!;

  const parsed = receivingSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const receiving = await tx.warehouseReceiving.create({
      data: { ...parsed.data, receivedById: user.id },
    });

    await tx.warehouseStock.upsert({
      where: { productId: parsed.data.productId },
      create: { productId: parsed.data.productId, qtyOnHand: parsed.data.qty },
      update: { qtyOnHand: { increment: parsed.data.qty } },
    });

    return receiving;
  });

  return NextResponse.json({ success: true, receiving_id: result.id });
}
