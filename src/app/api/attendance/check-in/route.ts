import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { checkInSchema } from "@/lib/validations/attendance";
import { DEFAULT_ATTENDANCE_POLICY } from "@/lib/policy";
import { startOfToday, toDateOnlyKey } from "@/lib/session";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  if (!user.outletId) {
    return NextResponse.json({ error: "User has no outlet assigned" }, { status: 400 });
  }

  const parsed = checkInSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const roster = await prisma.pramuniagaRoster.findUnique({ where: { id: parsed.data.pramuniagaRosterId } });
  if (!roster || roster.status !== "ACTIVE") {
    return NextResponse.json({ error: "Nama pramuniaga tidak valid" }, { status: 400 });
  }

  const today = startOfToday();
  const todayKey = toDateOnlyKey(today);
  const now = new Date();
  const outletId = user.outletId;

  // Each pramuniaga's attendance is fully independent — own timeIn/timeOut,
  // own shift, own checklist — so this looks up THIS SPECIFIC person's row
  // for today, not "the" session for the shared login.
  const existing = await prisma.attendanceRecord.findUnique({
    where: { userId_date_pramuniagaRosterId: { userId: user.id, date: todayKey, pramuniagaRosterId: parsed.data.pramuniagaRosterId } },
  });

  if (existing && existing.timeOut === null) {
    return NextResponse.json({ error: "Pramuniaga ini sudah check-in dan belum check-out" }, { status: 409 });
  }

  // A session checked in before midnight is still open under *yesterday's*
  // date key once the day rolls over — checked separately from `existing`
  // above (which only looked at today's key) so a still-open prior-day
  // session doesn't get silently left behind while a second, orphaned row
  // is created for today under the same person.
  const openElsewhere = await prisma.attendanceRecord.findFirst({
    where: { userId: user.id, pramuniagaRosterId: parsed.data.pramuniagaRosterId, timeOut: null },
  });
  if (openElsewhere) {
    return NextResponse.json({ error: "Pramuniaga ini sudah check-in dan belum check-out" }, { status: 409 });
  }

  if (!existing) {
    // A brand-new row for this person today — enforce the outlet's
    // concurrent-shift cap against everyone else currently checked in.
    const openCount = await prisma.attendanceRecord.count({ where: { outletId, date: todayKey, timeOut: null } });
    const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
    const maxAllowed = outlet?.maxPramuniagaPerShift ?? 4;
    if (openCount >= maxAllowed) {
      return NextResponse.json(
        {
          error: `Sudah ${maxAllowed} pramuniaga check-in pada outlet ini (batas outlet). Hubungi Master Admin untuk menaikkan batas.`,
        },
        { status: 409 },
      );
    }
  }

  const policy = (await prisma.attendancePolicy.findFirst()) ?? DEFAULT_ATTENDANCE_POLICY;
  const cutoff = new Date(today);
  cutoff.setHours(policy.checkpointStartHour, policy.gracePeriodMinutes, 0, 0);
  const status = now > cutoff ? "LATE" : "PRESENT";

  const record = await prisma.attendanceRecord.upsert({
    where: { userId_date_pramuniagaRosterId: { userId: user.id, date: todayKey, pramuniagaRosterId: parsed.data.pramuniagaRosterId } },
    create: {
      userId: user.id,
      outletId,
      date: todayKey,
      timeIn: now,
      gpsIn: parsed.data.gps,
      photoUrl: parsed.data.photoUrl,
      pramuniagaRosterId: parsed.data.pramuniagaRosterId,
      shift: parsed.data.shift,
      status,
    },
    update: {
      // Reopening this same person's already-closed-today row for a new
      // shift — clears the previous check-out fields.
      timeIn: now,
      timeOut: null,
      totalHours: null,
      gpsIn: parsed.data.gps,
      gpsOut: null,
      photoUrl: parsed.data.photoUrl,
      shift: parsed.data.shift,
      status,
    },
  });

  return NextResponse.json({ success: true, timestamp: record.timeIn, status: record.status });
}
