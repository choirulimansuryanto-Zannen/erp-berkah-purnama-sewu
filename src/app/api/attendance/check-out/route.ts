import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { checkOutSchema } from "@/lib/validations/attendance";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const parsed = checkOutSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();

  // Looked up by whichever open session this specific roster member actually
  // has — not by today's literal calendar date. A shift checked in before
  // midnight is still open on *yesterday's* date key after the day rolls
  // over, so anchoring to "today" here would silently find no match and
  // leave the person stuck open forever (the bug being fixed).
  const existing = await prisma.attendanceRecord.findFirst({
    where: { userId: user.id, pramuniagaRosterId: parsed.data.pramuniagaRosterId, timeOut: null },
    orderBy: { date: "desc" },
  });

  if (!existing?.timeIn) {
    return NextResponse.json({ error: "Belum check-in" }, { status: 400 });
  }

  const totalHours = (now.getTime() - existing.timeIn.getTime()) / 1000 / 60 / 60;

  const record = await prisma.attendanceRecord.update({
    where: { id: existing.id },
    data: { timeOut: now, gpsOut: parsed.data.gps, totalHours },
  });

  return NextResponse.json({ success: true, totalHours: record.totalHours, status: record.status });
}
