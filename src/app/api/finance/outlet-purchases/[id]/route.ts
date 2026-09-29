import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// A wrongly-entered Purchase Sheet line is just deleted outright — like
// InventoryClosingBalance, it isn't part of a double-entry audit trail
// (never posts a journal line by itself), so there's no void/reason step.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const row = await prisma.outletPurchase.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  await prisma.outletPurchase.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
