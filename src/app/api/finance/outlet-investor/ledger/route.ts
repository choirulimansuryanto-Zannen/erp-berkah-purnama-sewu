import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { updateInvestorLedgerCellSchema } from "@/lib/validations/outlet-investor";

// Upsert one (investor, year, month) ledger cell — Adj. and/or the
// Accum./Transfer-Shared manual locks. See lib/outlet-investor.ts.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = updateInvestorLedgerCellSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { investorId, year, month, adj, accumOverride, transferSharedOverride } = parsed.data;

  const values: Record<string, unknown> = { updatedById: user.id };
  if (adj !== undefined) values.adj = adj;
  if (accumOverride !== undefined) values.accumOverride = accumOverride;
  if (transferSharedOverride !== undefined) values.transferSharedOverride = transferSharedOverride;

  const row = await prisma.outletInvestorMonthlyLedger.upsert({
    where: { investorId_year_month: { investorId, year, month } },
    create: { investorId, year, month, adj: adj ?? 0, accumOverride: accumOverride ?? null, transferSharedOverride: transferSharedOverride ?? null, updatedById: user.id },
    update: values,
  });
  return NextResponse.json({ success: true, id: row.id });
}
