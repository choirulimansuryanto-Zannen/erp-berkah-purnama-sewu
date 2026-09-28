import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// A pramuniaga may only remove their own entries, and only before an SPV has
// acted on them — once approved/rejected it's part of the audit trail.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("expense:submit");
  if (!user) return response!;

  const existing = await prisma.expenseRecord.findUnique({ where: { id }, select: { submittedById: true, approvalStatus: true } });
  if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  if (existing.submittedById !== user.id) {
    return NextResponse.json({ error: "Bukan pengeluaran Anda" }, { status: 403 });
  }
  if (existing.approvalStatus !== "PENDING") {
    return NextResponse.json({ error: "Pengeluaran yang sudah diproses tidak bisa dihapus" }, { status: 409 });
  }

  await prisma.expenseRecord.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
