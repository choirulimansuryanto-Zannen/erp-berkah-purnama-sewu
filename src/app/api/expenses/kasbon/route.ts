import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { kasbonSchema } from "@/lib/validations/expenses";
import { getSessionDate } from "@/lib/session";
import { resolveEditableReportDate } from "@/lib/report-edit";

// Self-service — no approval workflow, unlike ExpenseRecord — a kasbon is
// logged the moment it's drawn, same as an operational expense entry.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("expense:submit");
  if (!user || !user.outletId) return response!;

  const parsed = kasbonSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const date =
    (await resolveEditableReportDate(user.outletId, user.id, parsed.data.date ?? null)) ?? (await getSessionDate(user.id));

  // Only a pramuniaga actually checked in today (open or already closed out)
  // under this login can be picked — prevents attributing a kasbon to
  // someone who was never on shift.
  const validRecord = await prisma.attendanceRecord.findFirst({
    where: { userId: user.id, date, pramuniagaRosterId: parsed.data.pramuniagaRosterId },
  });
  if (!validRecord) {
    return NextResponse.json({ error: "Pramuniaga tidak sedang bertugas pada tanggal ini" }, { status: 400 });
  }

  const kasbon = await prisma.kasbon.create({
    data: {
      outletId: user.outletId,
      pramuniagaId: user.id,
      pramuniagaRosterId: parsed.data.pramuniagaRosterId,
      amount: parsed.data.amount,
      notes: parsed.data.notes,
      date,
    },
  });

  return NextResponse.json({ kasbon_id: kasbon.id, success: true });
}
