import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// Unlike a JournalEntry, a stock-opname closing figure isn't part of the
// double-entry audit trail (it never posts a journal line by itself) — a
// wrongly-entered one is just deleted outright, no void/reason needed.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const row = await prisma.inventoryClosingBalance.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await prisma.inventoryClosingBalance.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
