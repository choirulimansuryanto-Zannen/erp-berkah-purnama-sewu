import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getScopedOutletIds } from "@/lib/outlet-scope";
import { PageHeader } from "@/components/ui/page-header";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { PivotLedgerTable, type PivotRow } from "@/components/region-summary/pivot-ledger-table";
import { CHANNEL_LABELS } from "@/components/transactions/channel-badge";

const CHANNEL_ORDER = ["GRAB", "GOFOOD", "SHOPEE", "TIKTOK", "QPON", "CASH", "CASHLESS"] as const;
// Same Offline/Online split used everywhere else in the app (Riwayat
// Transaksi's Customer Model breakdown) — Offline = Cash+Cashless+Qpon+TikTok,
// Online = Grab+GoFood+Shopee, per the established stakeholder spec.
const OFFLINE_CHANNELS = ["CASH", "CASHLESS", "QPON", "TIKTOK"] as const;
const ONLINE_CHANNELS = ["GRAB", "GOFOOD", "SHOPEE"] as const;

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateKey(d: Date): string {
  return localDateStr(d);
}

// Per-outlet daily ledger — same day-by-day, channel-broken-out pivot the
// business already tracks in its own spreadsheet, generated instead from
// the live database: Omset (with channel breakdown, running achievement vs
// target, and who worked), TC (transaction count), and APC (average value
// per transaction) — same shape, three different metrics.
export default async function OutletDailyLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ outletId: string }>;
  searchParams: Promise<{ from?: string; to?: string; showPramuniaga?: string; back?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "executive:view_dashboard")) redirect("/dashboard");

  const { outletId } = await params;
  // null scope = company-wide role (OFFICE/FA_ADMIN/MASTER_ADMIN), any
  // active outlet is in bounds; SPV is restricted to their own region.
  const scopedOutletIds = await getScopedOutletIds(user.id, user.role);
  if (scopedOutletIds && !scopedOutletIds.includes(outletId)) notFound();

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) notFound();

  const now = new Date();
  const { from, to, showPramuniaga, back } = await searchParams;
  // Dashboard Sales links here for a quick per-channel breakdown without
  // exposing who worked; Ringkasan Wilayah's own link keeps it (the
  // default) since that page is specifically about staffing + achievement.
  const includePramuniaga = showPramuniaga !== "false";
  const backHref = back === "executive" ? "/executive" : "/region-summary";
  const backLabel = back === "executive" ? "Kembali ke Dashboard Sales" : "Kembali ke Ringkasan Wilayah";
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeFrom = from ? new Date(`${from}T00:00:00`) : defaultFrom;
  rangeFrom.setHours(0, 0, 0, 0);
  const rangeTo = to ? new Date(`${to}T00:00:00`) : now;
  rangeTo.setHours(23, 59, 59, 999);
  const rangeToStartOfDay = new Date(rangeTo);
  rangeToStartOfDay.setHours(0, 0, 0, 0);
  const dayCount = Math.min(
    31,
    Math.max(1, Math.round((rangeToStartOfDay.getTime() - rangeFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1),
  );

  const [monthlyTarget, transactions, attendance] = await Promise.all([
    prisma.outletMonthlyTarget.findUnique({
      where: { outletId_year_month: { outletId, year: rangeFrom.getFullYear(), month: rangeFrom.getMonth() + 1 } },
    }),
    prisma.transaction.findMany({
      where: { outletId, status: "COMPLETED", createdAt: { gte: rangeFrom, lte: rangeTo } },
      select: { channel: true, total: true, createdAt: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { outletId, date: { gte: rangeFrom, lte: rangeTo } },
      include: { pramuniagaRoster: true },
      orderBy: { timeIn: "asc" },
    }),
  ]);

  const dailyTarget = Number(monthlyTarget?.dailyTarget ?? outlet.dailyTarget);

  const days = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(rangeFrom);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Bucket every transaction into its calendar day + channel.
  const byDay = new Map<string, { total: number; count: number; byChannel: Map<string, { total: number; count: number }> }>();
  for (const day of days) {
    byDay.set(dateKey(day), { total: 0, count: 0, byChannel: new Map(CHANNEL_ORDER.map((c) => [c, { total: 0, count: 0 }])) });
  }
  for (const t of transactions) {
    const key = dateKey(t.createdAt);
    const bucket = byDay.get(key);
    if (!bucket) continue;
    bucket.total += Number(t.total);
    bucket.count += 1;
    const chBucket = bucket.byChannel.get(t.channel);
    if (chBucket) {
      chBucket.total += Number(t.total);
      chBucket.count += 1;
    }
  }

  const namesByDay = new Map<string, string[]>();
  for (const a of attendance) {
    if (!a.pramuniagaRoster) continue;
    const key = dateKey(a.date);
    const list = namesByDay.get(key) ?? [];
    if (!list.includes(a.pramuniagaRoster.name)) list.push(a.pramuniagaRoster.name);
    namesByDay.set(key, list);
  }

  function groupTotals(day: Date, channels: readonly string[]): { total: number; count: number } {
    const bucket = byDay.get(dateKey(day))!;
    return channels.reduce(
      (acc, ch) => {
        const cb = bucket.byChannel.get(ch);
        return cb ? { total: acc.total + cb.total, count: acc.count + cb.count } : acc;
      },
      { total: 0, count: 0 },
    );
  }

  const dayLabels = days.map((d) => ({
    label: d.toLocaleDateString("id-ID", { weekday: "short" }),
    sublabel: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
  }));
  const pramuniagaValues = days.map((d) => namesByDay.get(dateKey(d))?.join(" / ") ?? "-");

  // Omset ledger — running achievement accumulates from the picked range's
  // own first day, same as the outlet's own spreadsheet (day 1's "berjalan"
  // figure equals day 1's own total).
  let cumOmset = 0;
  let cumTarget = 0;
  const omsetRows: PivotRow[] = [
    { label: "OMSET", values: days.map((d) => byDay.get(dateKey(d))!.total), highlight: "green", format: "currency" },
    ...CHANNEL_ORDER.map((ch) => ({
      label: CHANNEL_LABELS[ch] ?? ch,
      values: days.map((d) => byDay.get(dateKey(d))!.byChannel.get(ch)!.total),
      format: "currency" as const,
    })),
    { label: "OFFLINE", values: days.map((d) => groupTotals(d, OFFLINE_CHANNELS).total), format: "currency" },
    { label: "ONLINE", values: days.map((d) => groupTotals(d, ONLINE_CHANNELS).total), format: "currency" },
    { label: "TARGET", values: days.map(() => dailyTarget), format: "currency" },
    {
      label: "OMSET BERJALAN",
      values: days.map((d) => {
        cumOmset += byDay.get(dateKey(d))!.total;
        return cumOmset;
      }),
      format: "currency",
    },
    {
      label: "TARGET BERJALAN",
      values: days.map(() => {
        cumTarget += dailyTarget;
        return cumTarget;
      }),
      format: "currency",
    },
    {
      label: "PERSENTASE",
      values: (() => {
        let runOmset = 0;
        let runTarget = 0;
        return days.map((d) => {
          runOmset += byDay.get(dateKey(d))!.total;
          runTarget += dailyTarget;
          return runTarget > 0 ? `${Math.round((runOmset / runTarget) * 100)}%` : "-";
        });
      })(),
      highlight: "pink",
    },
    ...(includePramuniaga ? [{ label: "PRAMUNIAGA", values: pramuniagaValues, highlight: "cyan" as const }] : []),
  ];

  const tcRows: PivotRow[] = [
    { label: "TC", values: days.map((d) => byDay.get(dateKey(d))!.count), highlight: "green" },
    ...CHANNEL_ORDER.map((ch) => ({
      label: `${CHANNEL_LABELS[ch] ?? ch} TC`,
      values: days.map((d) => byDay.get(dateKey(d))!.byChannel.get(ch)!.count),
    })),
    { label: "OFFLINE TC", values: days.map((d) => groupTotals(d, OFFLINE_CHANNELS).count) },
    { label: "ONLINE TC", values: days.map((d) => groupTotals(d, ONLINE_CHANNELS).count) },
    ...(includePramuniaga ? [{ label: "PRAMUNIAGA", values: pramuniagaValues, highlight: "cyan" as const }] : []),
  ];

  const apcRows: PivotRow[] = [
    {
      label: "APC",
      values: days.map((d) => {
        const b = byDay.get(dateKey(d))!;
        return b.count > 0 ? Math.round(b.total / b.count) : 0;
      }),
      highlight: "green",
      format: "currency",
    },
    ...CHANNEL_ORDER.map((ch) => ({
      label: `${CHANNEL_LABELS[ch] ?? ch} APC`,
      values: days.map((d) => {
        const cb = byDay.get(dateKey(d))!.byChannel.get(ch)!;
        return cb.count > 0 ? Math.round(cb.total / cb.count) : 0;
      }),
      format: "currency" as const,
    })),
    {
      label: "OFFLINE APC",
      values: days.map((d) => {
        const g = groupTotals(d, OFFLINE_CHANNELS);
        return g.count > 0 ? Math.round(g.total / g.count) : 0;
      }),
      format: "currency",
    },
    {
      label: "ONLINE APC",
      values: days.map((d) => {
        const g = groupTotals(d, ONLINE_CHANNELS);
        return g.count > 0 ? Math.round(g.total / g.count) : 0;
      }),
      format: "currency",
    },
    ...(includePramuniaga ? [{ label: "PRAMUNIAGA", values: pramuniagaValues, highlight: "cyan" as const }] : []),
  ];

  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-700 hover:text-accent-800">
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Link>
      <PageHeader
        title={`Ledger Harian — ${outlet.name}`}
        description="Rincian harian omset, transaksi, dan rata-rata per transaksi, per channel."
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />

      <PivotLedgerTable title="OMSET (Rp)" days={dayLabels} rows={omsetRows} />
      <PivotLedgerTable title="TC — Transaction Count (jumlah struk)" days={dayLabels} rows={tcRows} />
      <PivotLedgerTable title="APC — Average Per Check (Rp/struk)" days={dayLabels} rows={apcRows} />
    </div>
  );
}
