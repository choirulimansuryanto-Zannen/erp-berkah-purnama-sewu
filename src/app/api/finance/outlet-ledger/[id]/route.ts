import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// Same convention as OutletPurchase/OutletAdjustment — a wrongly-entered
// ledger line is just deleted outright, no void/reason step.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const row = await prisma.outletLedgerEntry.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await prisma.outletLedgerEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
