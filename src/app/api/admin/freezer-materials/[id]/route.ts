import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { updateFreezerMaterialSchema } from "@/lib/validations/freezer-materials";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = updateFreezerMaterialSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.freezerMaterial.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, entry });
}

// Hard delete only when the item has never been used (no stock history to
// lose) — otherwise flipping status to INACTIVE via PUT is the safe way to
// remove it from active use without discarding real Saldo history.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const recordCount = await prisma.freezerStockRecord.count({ where: { freezerMaterialId: id } });
  if (recordCount > 0) {
    return NextResponse.json(
      { error: "Item ini sudah punya riwayat stock — nonaktifkan (ubah status) alih-alih menghapus." },
      { status: 409 },
    );
  }

  await prisma.freezerMaterial.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
