import { redirect } from "next/navigation";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getScopedOutletIds } from "@/lib/outlet-scope";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/components/ui/date-range-filter";

const DEFAULT_WINDOW_DAYS = 14;

function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A day only counts against an outlet's compliance if someone was actually
// checked in that day (operating) — a genuinely closed day (no attendance
// at all) is not a missed report.
export default async function ReportCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "SPV") redirect("/dashboard");

  const { from, to } = await searchParams;
  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - (DEFAULT_WINDOW_DAYS - 1));
  const windowStart = from ? new Date(`${from}T00:00:00.000Z`) : defaultFrom;
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = to ? new Date(`${to}T00:00:00.000Z`) : defaultTo;
  windowEnd.setUTCHours(23, 59, 59, 999);
  const windowEndStartOfDay = new Date(windowEnd);
  windowEndStartOfDay.setUTCHours(0, 0, 0, 0);
  const windowDays = Math.round((windowEndStartOfDay.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const scopedOutletIds = await getScopedOutletIds(user.id, user.role);
  if (!scopedOutletIds || scopedOutletIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kepatuhan Laporan" description="Ketepatan waktu pengiriman laporan harian outlet di wilayah Anda." />
        <p className="text-sm text-slate-500">Anda belum ditugaskan mengelola wilayah manapun.</p>
      </div>
    );
  }

  const [outlets, attendance, reports] = await Promise.all([
    prisma.outlet.findMany({ where: { id: { in: scopedOutletIds } } }),
    prisma.attendanceRecord.findMany({
      where: { outletId: { in: scopedOutletIds }, date: { gte: windowStart, lte: windowEnd } },
      select: { outletId: true, date: true },
    }),
    prisma.dailyReport.findMany({
      where: { outletId: { in: scopedOutletIds }, date: { gte: windowStart, lte: windowEnd } },
      select: { outletId: true, date: true, submittedAt: true },
    }),
  ]);

  const operatingDaysByOutlet = new Map<string, Set<string>>();
  for (const a of attendance) {
    const set = operatingDaysByOutlet.get(a.outletId) ?? new Set<string>();
    set.add(dateKey(a.date));
    operatingDaysByOutlet.set(a.outletId, set);
  }

  const reportByOutletDate = new Map<string, (typeof reports)[number]>();
  for (const r of reports) reportByOutletDate.set(`${r.outletId}_${dateKey(r.date)}`, r);

  // On time = submitted the same calendar day as the report's own date, or
  // the day after (closing out just past midnight) — anything later is late.
  function classify(outletId: string, day: string): "ontime" | "late" | "missing" {
    const report = reportByOutletDate.get(`${outletId}_${day}`);
    if (!report) return "missing";
    const reportDay = new Date(`${day}T00:00:00.000Z`);
    const cutoff = new Date(reportDay);
    cutoff.setUTCDate(cutoff.getUTCDate() + 2);
    return report.submittedAt < cutoff ? "ontime" : "late";
  }

  const outletStats = outlets.map((o) => {
    const operatingDays = [...(operatingDaysByOutlet.get(o.id) ?? new Set<string>())].sort();
    let ontime = 0,
      late = 0,
      missing = 0;
    for (const day of operatingDays) {
      const c = classify(o.id, day);
      if (c === "ontime") ontime++;
      else if (c === "late") late++;
      else missing++;
    }
    const total = operatingDays.length;
    const pct = total > 0 ? Math.round((ontime / total) * 100) : 100;
    return { id: o.id, name: o.name, total, ontime, late, missing, pct };
  });

  const totalOperatingDays = outletStats.reduce((s, o) => s + o.total, 0);
  const totalOntime = outletStats.reduce((s, o) => s + o.ontime, 0);
  const totalLate = outletStats.reduce((s, o) => s + o.late, 0);
  const totalMissing = outletStats.reduce((s, o) => s + o.missing, 0);
  const overallPct = totalOperatingDays > 0 ? Math.round((totalOntime / totalOperatingDays) * 100) : 100;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kepatuhan Laporan"
        description={`Ketepatan waktu pengiriman laporan harian, ${windowDays} hari terpilih — ${outlets.length} outlet di wilayah Anda.`}
        actions={<DateRangeFilter from={localDateStr(windowStart)} to={localDateStr(windowEnd)} />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Tingkat Kepatuhan"
          value={`${overallPct}%`}
          tone={overallPct >= 90 ? "success" : overallPct >= 70 ? "warning" : "danger"}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard label="Tepat Waktu" value={String(totalOntime)} tone="success" />
        <StatCard label="Terlambat" value={String(totalLate)} tone="warning" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Belum Lapor" value={String(totalMissing)} tone={totalMissing > 0 ? "danger" : "success"} icon={<ShieldX className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kepatuhan per Outlet</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Outlet</Th>
              <Th>Hari Operasional</Th>
              <Th>Tepat Waktu</Th>
              <Th>Terlambat</Th>
              <Th>Belum Lapor</Th>
              <Th>Skor Kepatuhan</Th>
            </tr>
          </Thead>
          <tbody>
            {outletStats
              .sort((a, b) => a.pct - b.pct)
              .map((o) => (
                <Tr key={o.id}>
                  <Td className="font-medium text-slate-900">{o.name}</Td>
                  <Td>{o.total} hari</Td>
                  <Td className="text-emerald-700">{o.ontime}</Td>
                  <Td className="text-amber-700">{o.late}</Td>
                  <Td className="text-rose-700">{o.missing}</Td>
                  <Td>
                    <Badge tone={o.pct >= 90 ? "success" : o.pct >= 70 ? "warning" : "danger"}>{o.pct}%</Badge>
                  </Td>
                </Tr>
              ))}
            {outletStats.length === 0 && <EmptyRow colSpan={6}>Belum ada outlet di wilayah Anda.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
