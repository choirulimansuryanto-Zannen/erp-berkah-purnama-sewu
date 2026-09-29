import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { updateOutletMaterialSchema } from "@/lib/validations/incentive";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = updateOutletMaterialSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const material = await prisma.outletMaterial.update({ where: { id }, data: { ...parsed.data, updatedById: user.id } });
  return NextResponse.json({ success: true, material });
}

// Hard-delete only if never referenced by a purchase, adjustment or closing
// balance — otherwise point at INACTIVE status instead, same convention as
// ExpenseCategoryDef.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const material = await prisma.outletMaterial.findUnique({ where: { id } });
  if (!material) return NextResponse.json({ error: "Material tidak ditemukan" }, { status: 404 });

  const [purchaseCount, adjustmentCount, closingCount] = await Promise.all([
    prisma.outletPurchase.count({ where: { materialId: id } }),
    prisma.outletAdjustment.count({ where: { materialId: id } }),
    prisma.outletMaterialClosingBalance.count({ where: { materialId: id } }),
  ]);
  if (purchaseCount + adjustmentCount + closingCount > 0) {
    return NextResponse.json(
      { error: "Material ini sudah pernah dipakai — nonaktifkan (status INACTIVE) alih-alih menghapus." },
      { status: 409 },
    );
  }

  await prisma.outletMaterial.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
