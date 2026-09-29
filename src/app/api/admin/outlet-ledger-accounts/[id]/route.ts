import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { updateOutletLedgerAccountSchema } from "@/lib/validations/outlet-ledger";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = updateOutletLedgerAccountSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const account = await prisma.outletLedgerAccount.update({ where: { id }, data: { ...parsed.data, updatedById: user.id } });
  return NextResponse.json({ success: true, account });
}

// Hard-delete only if never referenced by a ledger entry — otherwise point
// at INACTIVE status instead, same convention as ExpenseCategoryDef.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const account = await prisma.outletLedgerAccount.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });

  const usageCount = await prisma.outletLedgerEntry.count({ where: { accountId: id } });
  if (usageCount > 0) {
    return NextResponse.json(
      { error: "Akun ini sudah pernah dipakai — nonaktifkan (status INACTIVE) alih-alih menghapus." },
      { status: 409 },
    );
  }

  await prisma.outletLedgerAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
