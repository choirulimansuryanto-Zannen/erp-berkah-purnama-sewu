import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { expenseManualEntrySchema } from "@/lib/validations/expenses";
import { getSessionDate } from "@/lib/session";
import { resolveEditableReportDate } from "@/lib/report-edit";

// Per-channel Online & Cashless figures and Paket Kopdes/MBG sold counts are
// cashier-entered (2026-08-12 stakeholder decision), not derived from POS
// transaction data — one row per pramuniaga per session, upserted wholesale
// on every save (the form always submits the full set of fields).
export async function POST(request: Request) {
  const { user, response } = await requirePermission("expense:submit");
  if (!user || !user.outletId) return response!;

  const parsed = expenseManualEntrySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const date =
    (await resolveEditableReportDate(user.outletId, user.id, parsed.data.date ?? null)) ?? (await getSessionDate(user.id));
  const {
    gofoodAmount = 0,
    grabAmount = 0,
    shopeeAmount = 0,
    tiktokAmount = 0,
    qponAmount = 0,
    cashlessAmount = 0,
    qtyKopdes = 0,
    qtyMbg = 0,
  } = parsed.data;

  const entry = await prisma.expenseManualEntry.upsert({
    where: { outletId_pramuniagaId_date: { outletId: user.outletId, pramuniagaId: user.id, date } },
    create: {
      outletId: user.outletId,
      pramuniagaId: user.id,
      date,
      gofoodAmount,
      grabAmount,
      shopeeAmount,
      tiktokAmount,
      qponAmount,
      cashlessAmount,
      qtyKopdes,
      qtyMbg,
    },
    update: { gofoodAmount, grabAmount, shopeeAmount, tiktokAmount, qponAmount, cashlessAmount, qtyKopdes, qtyMbg },
  });

  return NextResponse.json({ success: true, id: entry.id });
}
