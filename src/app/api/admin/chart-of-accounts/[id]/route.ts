import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { chartOfAccountSchema } from "@/lib/validations/accounting";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = chartOfAccountSchema.partial().safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.code) {
    const codeOwner = await prisma.chartOfAccount.findUnique({ where: { code: parsed.data.code } });
    if (codeOwner && codeOwner.id !== id) {
      return NextResponse.json({ error: "Kode akun sudah dipakai akun lain" }, { status: 409 });
    }
  }

  const account = await prisma.chartOfAccount.update({
    where: { id },
    data: { ...parsed.data, updatedById: user.id },
  });
  return NextResponse.json({ success: true, account });
}

// Hard-delete only if never posted to and has no child accounts — otherwise
// set status: INACTIVE instead, same convention as other master data. The
// six cash-book control accounts can never be deleted at all (removing one
// would orphan a whole cash book).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const account = await prisma.chartOfAccount.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });

  if (account.cashBook) {
    return NextResponse.json({ error: "Akun buku kas inti tidak dapat dihapus." }, { status: 409 });
  }

  const [lineCount, childCount] = await Promise.all([
    prisma.journalEntryLine.count({ where: { accountId: id } }),
    prisma.chartOfAccount.count({ where: { parentId: id } }),
  ]);
  if (lineCount > 0 || childCount > 0) {
    return NextResponse.json(
      { error: "Akun ini sudah pernah dipakai jurnal atau punya sub-akun — nonaktifkan (status INACTIVE) alih-alih menghapus." },
      { status: 409 },
    );
  }

  await prisma.chartOfAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
