import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { minLevelSchema } from "@/lib/validations/warehouse";

export async function PUT(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const { user, response } = await requirePermission("warehouse:manage");
  if (!user) return response!;

  const parsed = minLevelSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const stock = await prisma.warehouseStock.upsert({
    where: { productId },
    create: { productId, minLevel: parsed.data.minLevel },
    update: { minLevel: parsed.data.minLevel },
  });

  return NextResponse.json({ success: true, stock });
}
