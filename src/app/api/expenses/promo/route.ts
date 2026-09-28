import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { promoDiscountSchema } from "@/lib/validations/expenses";
import { getSessionDate } from "@/lib/session";
import { resolveEditableReportDate } from "@/lib/report-edit";

// One value per pramuniaga per session (unlike Kasbon/ExpenseRecord, which
// are append-only logs) — re-submitting overwrites the same row.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("expense:submit");
  if (!user || !user.outletId) return response!;

  const parsed = promoDiscountSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const date =
    (await resolveEditableReportDate(user.outletId, user.id, parsed.data.date ?? null)) ?? (await getSessionDate(user.id));

  const promo = await prisma.promoDiscount.upsert({
    where: { outletId_pramuniagaId_date: { outletId: user.outletId, pramuniagaId: user.id, date } },
    create: { outletId: user.outletId, pramuniagaId: user.id, date, amount: parsed.data.amount, notes: parsed.data.notes },
    update: { amount: parsed.data.amount, notes: parsed.data.notes },
  });

  return NextResponse.json({ success: true, amount: Number(promo.amount) });
}
