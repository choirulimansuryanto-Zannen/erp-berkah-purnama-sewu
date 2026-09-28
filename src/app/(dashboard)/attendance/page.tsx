import Link from "next/link";
import { CalendarClock, ChevronRight, MapPin } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { CheckInPanel } from "@/components/attendance/check-in-panel";
import { OperationalChecklistSection } from "@/components/attendance/operational-checklist-section";
import { getSessionDate, toDateOnlyKey } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SHIFT_LABELS: Record<string, string> = { SHIFT_1: "Shift 1", SHIFT_2: "Shift 2", FULLSHIFT: "Fullshift" };
// Same shift color convention as Riwayat Setoran's PramuniagaShiftEntry rows —
// kept visually consistent across the app.
const SHIFT_TAG_CLASSES: Record<string, string> = {
  SHIFT_1: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
  SHIFT_2: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
  FULLSHIFT: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
};

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Coordinates are stored as a plain "lat,lng" string (see checkInSchema) —
// linked out to Google Maps so a supervisor reviewing history can actually
// see where the check-in/out photo was taken, not just read raw numbers.
function GpsLink({ gps }: { gps: string | null }) {
  if (!gps) {
    return <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">Lokasi tidak tercatat</p>;
  }
  return (
    <a
      href={`https://www.google.com/maps?q=${gps}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex items-center gap-1 text-xs font-medium text-accent-700 hover:text-accent-800 hover:underline"
    >
      <MapPin className="h-3 w-3 shrink-0" />
      {gps}
    </a>
  );
}

async function PersonalAttendance({
  userId,
  outletId,
  outletLabel,
  defaultShift,
  selectedDate,
  historyFrom,
  historyTo,
}: {
  userId: string;
  outletId: string;
  outletLabel: string;
  defaultShift: "SHIFT_1" | "SHIFT_2" | "FULLSHIFT";
  selectedDate?: string;
  historyFrom?: string;
  historyTo?: string;
}) {
  // A date param means "browse history for that exact day" (read-only) —
  // otherwise this is the live view keyed to the current/most recent
  // session, matching the existing check-in/checklist flow unchanged.
  if (selectedDate) {
    // Parsed as UTC (not local) midnight of that calendar date — this must
    // match toDateOnlyKey's serialization exactly, since it's compared
    // against a @db.Date column (see toDateOnlyKey in session-date-helpers.ts).
    const viewDate = new Date(`${selectedDate}T00:00:00Z`);
    const [records, submissions] = await Promise.all([
      // Each pramuniaga keeps their own independent row now — a day can
      // have several, not just one.
      prisma.attendanceRecord.findMany({
        where: { userId, date: viewDate },
        include: { pramuniagaRoster: true },
        orderBy: { timeIn: "asc" },
      }),
      prisma.operationalChecklistSubmission.findMany({
        where: { outletId, date: viewDate },
        include: { item: true, pramuniagaRoster: true },
        orderBy: { item: { sortOrder: "asc" } },
      }),
    ]);

    const dateLabel = viewDate.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Presensi — {dateLabel}</CardTitle>
          </CardHeader>
          {records.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {records.map((record) => (
                <div key={record.id} className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nama Pramuniaga</p>
                      <p className="font-medium text-slate-800">{record.pramuniagaRoster?.name ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Shift</p>
                      <p className="font-medium text-slate-800">{SHIFT_LABELS[record.shift] ?? record.shift}</p>
                    </div>
                    <div>
                      <StatusBadge status={record.status} />
                    </div>
                  </div>

                  {/* Right side: exactly when and where this check-in/out happened. */}
                  <div className="rounded-xl bg-slate-50 p-4 sm:grid sm:grid-cols-2 sm:gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Check-in</p>
                      <p className="font-medium text-slate-800">
                        {record.timeIn
                          ? `${record.timeIn.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}, ${record.timeIn.toLocaleTimeString("id-ID")}`
                          : "-"}
                      </p>
                      <GpsLink gps={record.gpsIn} />
                    </div>
                    <div className="mt-3 sm:mt-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Check-out</p>
                      <p className="font-medium text-slate-800">
                        {record.timeOut
                          ? `${record.timeOut.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}, ${record.timeOut.toLocaleTimeString("id-ID")}`
                          : "Belum check-out"}
                      </p>
                      <GpsLink gps={record.gpsOut} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-400">Tidak ada data presensi pada tanggal ini.</p>
          )}
        </Card>

        {records.map((record) => {
          const own = submissions.filter((s) => s.pramuniagaRosterId === record.pramuniagaRosterId);
          return (
            <Card key={record.id}>
              <CardHeader>
                <CardTitle>Checklist Operasional — {record.pramuniagaRoster?.name ?? "-"}</CardTitle>
                <span className="ml-auto text-xs font-medium text-slate-400">{own.length} item terisi</span>
              </CardHeader>
              {own.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {own.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.photoUrl} alt={s.item.subLabel || s.item.category} className="h-9 w-9 rounded-md object-cover" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{s.item.subLabel || s.item.category}</p>
                        <p className="truncate text-xs text-slate-400">{s.item.category}</p>
                      </div>
                      <span className="ml-auto text-xs text-slate-400">{s.submittedAt.toLocaleTimeString("id-ID")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-10 text-center text-sm text-slate-400">Belum ada checklist yang diisi pada tanggal ini.</p>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  // The open (or most recent) session's date, not the calendar day — a
  // check-in from yesterday that hasn't checked out yet is still "today's"
  // session for display purposes.
  const sessionDate = await getSessionDate(userId);

  const [records, roster, outlet] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { userId, date: sessionDate },
      include: { pramuniagaRoster: true },
      orderBy: { timeIn: "asc" },
    }),
    prisma.pramuniagaRoster.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.outlet.findUnique({ where: { id: outletId } }),
  ]);

  const openRecords = records.filter((r) => r.timeOut === null && r.pramuniagaRosterId);
  const openRosterIds = new Set(openRecords.map((r) => r.pramuniagaRosterId));
  const maxAllowed = outlet?.maxPramuniagaPerShift ?? 4;

  const timeFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  const openParticipants = openRecords.map((r) => ({
    id: r.pramuniagaRosterId!,
    name: r.pramuniagaRoster?.name ?? "-",
    shift: r.shift,
    timeIn: r.timeIn ? `${timeFormat.format(r.timeIn)} WIB` : "-",
  }));

  const checklistItems =
    openRecords.length > 0 ? await prisma.operationalChecklistItem.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }) : [];
  const checklistSubmissions =
    openRecords.length > 0
      ? await prisma.operationalChecklistSubmission.findMany({
          where: { outletId, date: sessionDate, pramuniagaRosterId: { in: openRecords.map((r) => r.pramuniagaRosterId!) } },
          select: { itemId: true, photoUrl: true, pramuniagaRosterId: true },
        })
      : [];

  return (
    <div className="space-y-4">
      <CheckInPanel
        outletLabel={outletLabel}
        defaultShift={defaultShift}
        roster={roster.map((r) => ({ id: r.id, name: r.name })).filter((r) => !openRosterIds.has(r.id))}
        openParticipants={openParticipants}
        maxParticipants={maxAllowed}
      />
      {openParticipants.map((p) => (
        <OperationalChecklistSection
          key={p.id}
          pramuniagaRosterId={p.id}
          pramuniagaName={p.name}
          items={checklistItems.map((i) => ({ id: i.id, category: i.category, subLabel: i.subLabel }))}
          initialSubmissions={checklistSubmissions
            .filter((s) => s.pramuniagaRosterId === p.id)
            .map((s) => ({ itemId: s.itemId, photoUrl: s.photoUrl }))}
        />
      ))}
      <AttendanceHistoryList userId={userId} sessionDate={sessionDate} historyFrom={historyFrom} historyTo={historyTo} />
    </div>
  );
}

// Browsable list of past attendance days (a day can have several rows now —
// more than one pramuniaga may have covered it) — each links into the
// existing ?date= detail view (attendance + that day's checklists) rather
// than requiring the pramuniaga to already know/type a date. Defaults to the
// current running month; a Dari/Sampai range picker reaches further back.
async function AttendanceHistoryList({
  userId,
  sessionDate,
  historyFrom,
  historyTo,
}: {
  userId: string;
  sessionDate: Date;
  historyFrom?: string;
  historyTo?: string;
}) {
  const now = new Date();
  const monthStart = toDateOnlyKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const rangeFrom = historyFrom ? new Date(`${historyFrom}T00:00:00Z`) : monthStart;
  const rangeTo = historyTo ? new Date(`${historyTo}T00:00:00Z`) : sessionDate;
  const rangeFromStr = historyFrom ?? localDateStr(monthStart);
  const rangeToStr = historyTo ?? localDateStr(sessionDate);

  const records = (
    await prisma.attendanceRecord.findMany({
      where: { userId, date: { gte: rangeFrom, lte: rangeTo } },
      include: { pramuniagaRoster: true },
      orderBy: { date: "desc" },
      take: 600,
    })
  ).filter(
    // Anyone still open on the session date is already shown live above —
    // everyone else (including a fully-checked-out session date, once
    // nobody's left open on it) belongs here instead. Excluding the whole
    // session date outright would hide it the moment it's fully closed out
    // but no later day exists yet to have pushed sessionDate forward.
    (r) => !(r.date.getTime() === sessionDate.getTime() && r.timeOut === null),
  );

  const byDate = new Map<string, typeof records>();
  for (const r of records) {
    const key = r.date.toISOString();
    const list = byDate.get(key) ?? [];
    list.push(r);
    byDate.set(key, list);
  }
  const dateFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex-wrap gap-3">
        <div>
          <CardTitle>Riwayat Presensi</CardTitle>
          <p className="mt-0.5 text-xs text-slate-400">{byDate.size} hari tercatat pada periode terpilih</p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-500">Dari</label>
            <input
              type="date"
              name="historyFrom"
              defaultValue={rangeFromStr}
              max={localDateStr(now)}
              className="mt-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500">Sampai</label>
            <input
              type="date"
              name="historyTo"
              defaultValue={rangeToStr}
              max={localDateStr(now)}
              className="mt-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Tampilkan
          </Button>
          {(historyFrom || historyTo) && (
            <a href="/attendance">
              <Button type="button" variant="ghost" size="sm">
                Bulan Ini
              </Button>
            </a>
          )}
        </form>
      </CardHeader>
      {records.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">Tidak ada data presensi pada periode ini.</p>}
      <div className="divide-y divide-slate-100">
        {[...byDate.entries()].map(([dateKey, dayRecords]) => (
          <a
            key={dateKey}
            href={`/attendance?date=${dateKey.slice(0, 10)}`}
            className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/60"
          >
            <div className="w-40 shrink-0 text-xs font-semibold text-slate-500">{dateFormat.format(new Date(dateKey))}</div>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {dayRecords.map((r) => (
                <span
                  key={r.id}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    SHIFT_TAG_CLASSES[r.shift] ?? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
                  )}
                >
                  {r.pramuniagaRoster?.name ?? "-"} · {SHIFT_LABELS[r.shift] ?? r.shift}
                </span>
              ))}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </a>
        ))}
      </div>
    </Card>
  );
}

async function TeamAttendance() {
  const today = toDateOnlyKey(new Date());

  const [records, pendingLeaves] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { date: today },
      include: { user: true, outlet: true, pramuniagaRoster: true },
      orderBy: [{ user: { name: "asc" } }, { timeIn: "asc" }],
    }),
    prisma.leavePermission.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance Hari Ini</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Login</Th>
              <Th>Pramuniaga</Th>
              <Th>Shift</Th>
              <Th>Outlet</Th>
              <Th>Check-in</Th>
              <Th>Check-out</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <tbody>
            {records.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-slate-900">{r.user.name}</Td>
                <Td>{r.pramuniagaRoster?.name ?? "-"}</Td>
                <Td>{SHIFT_LABELS[r.shift] ?? r.shift}</Td>
                <Td>{r.outlet.name}</Td>
                <Td>{r.timeIn ? r.timeIn.toLocaleTimeString() : "-"}</Td>
                <Td>{r.timeOut ? r.timeOut.toLocaleTimeString() : "-"}</Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
              </Tr>
            ))}
            {records.length === 0 && <EmptyRow colSpan={7}>Belum ada data hari ini.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permintaan OFF/Sakit Menunggu Persetujuan</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-slate-100">
          {pendingLeaves.map((leave) => (
            <li key={leave.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-slate-700">
                <span className="font-medium text-slate-900">{leave.user.name}</span> — {leave.type} (
                {leave.dateFrom.toLocaleDateString()} - {leave.dateTo.toLocaleDateString()})
              </span>
              <span className="text-slate-400">{leave.reason}</span>
            </li>
          ))}
          {pendingLeaves.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-slate-400">Tidak ada permintaan pending.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; historyFrom?: string; historyTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { date, historyFrom, historyTo } = await searchParams;
  const showTeamView = can(user.role, "attendance:view_team");
  const outletLabel = user.outlet ? `[${user.outlet.region.name.replace(/^Region /, "").toUpperCase()} AREA] ${user.outlet.name}` : "-";

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.role === "PRAMUNIAGA" ? "Activity Checklist Pramu" : "Attendance"}
        description={
          user.role === "PRAMUNIAGA"
            ? "Check-in/check-out dan checklist operasional harian."
            : "Kehadiran, checklist, dan permintaan cuti."
        }
        actions={
          user.role === "PRAMUNIAGA" ? (
            <div className="flex flex-wrap items-center gap-2">
              <form className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  name="date"
                  defaultValue={date ?? ""}
                  max={localDateStr(new Date())}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                />
                <Button type="submit" variant="outline" size="sm">
                  Lihat Riwayat
                </Button>
              </form>
              {date && (
                // A plain anchor (not next/link) deliberately — the date
                // form above is a native, uncontrolled GET form that causes
                // a full page reload, not a Next.js client-side transition.
                // Mixing that with a router-based Link here creates a race
                // where a click right after the form's hard navigation can
                // land before the router finishes (re)hydrating, silently
                // swallowing the click. A native anchor sidesteps the router
                // entirely, matching the same navigation mechanism already
                // in play on this page.
                <a href="/attendance">
                  <Button variant="ghost" size="sm">
                    Kembali ke Hari Ini
                  </Button>
                </a>
              )}
              <Link href="/pos">
                <Button variant="outline" size="sm">
                  ← Kembali ke Kasir (POS)
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />
      {user.role === "PRAMUNIAGA" && user.outletId ? (
        <PersonalAttendance
          userId={user.id}
          outletId={user.outletId}
          outletLabel={outletLabel}
          defaultShift={user.shift}
          selectedDate={date}
          historyFrom={historyFrom}
          historyTo={historyTo}
        />
      ) : showTeamView ? (
        <TeamAttendance />
      ) : (
        <p className="text-sm text-slate-500">Tidak ada data attendance untuk role ini.</p>
      )}
    </div>
  );
}
