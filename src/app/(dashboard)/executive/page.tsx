import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  TrendingUp,
  Users2,
  Wallet,
  ChevronRight,
  Landmark,
  Scale,
  FileCheck2,
  PieChart,
  Banknote,
  GitCompareArrows,
  Sparkles,
  Receipt,
  History,
  NotebookPen,
  Table2,
  Boxes,
  Factory,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getScopedOutletIds } from "@/lib/outlet-scope";
import { classifyPace, elapsedBusinessFraction } from "@/lib/pacing";
import { getBusinessSettings } from "@/lib/business-settings";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { OmsetTrendChart } from "@/components/executive/omset-trend-chart";
import { FormattedBarChart, FormattedDonutChart } from "@/components/ui/formatted-charts";
import { CHANNEL_COLORS, CHANNEL_LABELS } from "@/components/transactions/channel-badge";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getMonthlyAccountMatrix,
  getMonthlyHppReport,
  getAnnualFinancialSummary,
  computeLabaBersihSeries,
  accountSubtree,
  typeNaturalValue,
  REVENUE_GROUPS,
  CASH_BOOK_LABELS,
} from "@/lib/accounting";
import { FaTrendChart } from "@/components/finance/fa-trend-chart";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const ZERO_12 = () => Array.from({ length: 12 }, () => 0);
function addSeries(...series: number[][]): number[] {
  return ZERO_12().map((_, i) => series.reduce((s, arr) => s + arr[i], 0));
}

const FA_QUICK_LINKS = [
  { href: "/finance/journal", label: "Jurnal (6 Buku Kas)", icon: Receipt },
  { href: "/finance/ledger", label: "Buku Besar", icon: History },
  { href: "/finance/adjusting-entries", label: "Jurnal Penyesuaian", icon: NotebookPen },
  { href: "/finance/worksheet", label: "Worksheet (Neraca Lajur)", icon: Table2 },
  { href: "/finance/persediaan", label: "Persediaan", icon: Boxes },
  { href: "/finance/hpp", label: "Laporan HPP", icon: Factory },
  { href: "/finance/reports", label: "Laba Rugi", icon: FileCheck2 },
  { href: "/finance/equity-changes", label: "Perubahan Ekuitas", icon: PieChart },
  { href: "/finance/neraca", label: "Neraca", icon: Scale },
  { href: "/finance/cash-flow", label: "Laporan Arus Kas", icon: Banknote },
  { href: "/finance/perbandingan-tahunan", label: "Perbandingan Tahunan", icon: GitCompareArrows },
  { href: "/finance/insights", label: "Analisis & Insight", icon: Sparkles },
];

const faCurrency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

// FA Executive Dashboard — the Sales-executive view below (omset/channel/
// region/outlet pace) has nothing to do with an FA_ADMIN's job, so this
// role gets its own dedicated executive view built entirely from the FA
// reporting engine (getMonthlyAccountMatrix, getMonthlyHppReport,
// getAnnualFinancialSummary) instead — every figure here is read from the
// exact same functions each single-purpose FA report page already uses, so
// nothing shown here can disagree with what that report itself displays.
async function FaExecutiveDashboard({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const [matrix, hppReport, summary, priorSummaries] = await Promise.all([
    getMonthlyAccountMatrix(year),
    getMonthlyHppReport(year),
    getAnnualFinancialSummary(year),
    Promise.all([year - 2, year - 1].map((y) => getAnnualFinancialSummary(y))),
  ]);

  function subtreeMonthly(rootCode: string): number[] {
    const accounts = accountSubtree(matrix, rootCode).filter((a) => a.code !== rootCode);
    return addSeries(...accounts.map((a) => a.monthly.map((v) => typeNaturalValue(v, a.type, a.normalBalance))));
  }
  const penjualanMonthly = addSeries(...REVENUE_GROUPS.map((g) => subtreeMonthly(g.code)));
  const labaBersihMonthly = computeLabaBersihSeries(matrix, hppReport.cashBasisHpp);
  const trendData = MONTH_NAMES.map((label, i) => ({
    label: `${label} ${String(year).slice(2)}`,
    penjualan: penjualanMonthly[i],
    hpp: hppReport.cashBasisHpp[i],
    labaBersih: labaBersihMonthly[i],
  })).slice(0, upToMonth + 1);

  const cashAccounts = matrix.filter((a) => a.cashBook);
  const totalCash = cashAccounts.reduce((s, a) => s + a.cumulative[upToMonth], 0);
  const cashDonutData = cashAccounts
    .map((a, i) => ({
      name: CASH_BOOK_LABELS[a.cashBook!],
      value: a.cumulative[upToMonth],
      color: ["#2f56c4", "#0f9d58", "#e2725b", "#f2b000", "#7c3aed", "#0d9488"][i % 6],
    }))
    .filter((c) => c.value !== 0);

  const bebanOperasionalAccounts = accountSubtree(matrix, "60000").filter((a) => a.code !== "60000");
  const topBeban = bebanOperasionalAccounts
    .map((a) => ({ name: a.name, value: a.monthly.slice(0, upToMonth + 1).reduce((s, v) => s + v, 0) }))
    .filter((a) => a.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const isBalanced = Math.abs(summary.totalAktiva - (summary.totalKewajiban + summary.totalEkuitas)) < 1;
  const netMargin = summary.totalPenjualan > 0 ? (summary.labaBersih / summary.totalPenjualan) * 100 : 0;

  const yearHistory = [...priorSummaries, summary];

  return (
    <div className="space-y-6">
      <PageHeader
        title="FA Executive Dashboard"
        description={`Ringkasan keuangan perusahaan — Finance & Accounting. Periode berjalan s/d ${MONTH_NAMES[upToMonth]} ${year}.`}
        actions={
          <form className="flex items-end gap-2">
            <div>
              <Label className="text-[11px]">Tahun</Label>
              <Select name="year" defaultValue={String(year)} className="mt-1">
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Tampilkan
            </Button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={`Total Penjualan ${year}`} value={faCurrency.format(summary.totalPenjualan)} tone="brand" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard
          label="Laba Bersih (Setelah Accrual)"
          value={faCurrency.format(summary.labaBersih)}
          hint={`Margin bersih ${netMargin.toFixed(1)}%`}
          tone={summary.labaBersih >= 0 ? "success" : "danger"}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard label="Kas & Bank Saat Ini" value={faCurrency.format(totalCash)} tone="accent" icon={<Wallet className="h-4 w-4" />} />
        <StatCard
          label="Total Aktiva"
          value={faCurrency.format(summary.totalAktiva)}
          hint={isBalanced ? "✓ Neraca Seimbang" : "⚠ Neraca Tidak Seimbang"}
          tone={isBalanced ? "success" : "danger"}
          icon={<Landmark className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tren Penjualan, HPP & Laba Bersih — {year}</CardTitle>
        </CardHeader>
        <div className="p-5 pt-2">
          <FaTrendChart data={trendData} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Posisi Kas & Bank — per {MONTH_NAMES[upToMonth]} {year}</CardTitle>
          </CardHeader>
          <div className="p-5">
            <FormattedDonutChart data={cashDonutData} format="currency" centerLabel="Total Kas" />
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Beban Operasional Terbesar (YTD)</CardTitle>
          </CardHeader>
          <div className="p-5">
            <FormattedBarChart data={topBeban} format="currency" defaultColor="#e2725b" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Neraca — Posisi per {MONTH_NAMES[upToMonth]} {year}</CardTitle>
          <Link href="/finance/neraca" className="inline-flex items-center gap-1 text-xs font-bold text-accent-700 hover:text-accent-800">
            Lihat Neraca Lengkap <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 p-5 pt-2 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Aktiva</p>
            <p className="mt-1 text-xl font-bold text-brand-900">{faCurrency.format(summary.totalAktiva)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Kewajiban</p>
            <p className="mt-1 text-xl font-bold text-brand-900">{faCurrency.format(summary.totalKewajiban)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Ekuitas</p>
            <p className="mt-1 text-xl font-bold text-brand-900">{faCurrency.format(summary.totalEkuitas)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perbandingan Tahunan (ringkas)</CardTitle>
          <Link href="/finance/perbandingan-tahunan" className="inline-flex items-center gap-1 text-xs font-bold text-accent-700 hover:text-accent-800">
            Lihat Perbandingan Lengkap <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Tahun</Th>
              <Th className="text-right">Total Penjualan</Th>
              <Th className="text-right">HPP (Basis Kas)</Th>
              <Th className="text-right">Laba Bersih</Th>
              <Th className="text-right">Total Aktiva</Th>
            </tr>
          </Thead>
          <tbody>
            {yearHistory.map((s) => (
              <Tr key={s.year}>
                <Td className="font-medium text-slate-900">{s.year}</Td>
                <Td className="text-right">{faCurrency.format(s.totalPenjualan)}</Td>
                <Td className="text-right">{faCurrency.format(s.hpp)}</Td>
                <Td className="text-right">
                  <Badge tone={s.labaBersih >= 0 ? "success" : "danger"}>{faCurrency.format(s.labaBersih)}</Badge>
                </Td>
                <Td className="text-right">{faCurrency.format(s.totalAktiva)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Akses Cepat — FA Company</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3 p-5 pt-2 sm:grid-cols-3 lg:grid-cols-4">
          {FA_QUICK_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white p-3.5 text-sm font-medium text-brand-900 shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[var(--shadow-card-hover)]"
              >
                <Icon className="h-4 w-4 shrink-0 text-accent-600" />
                {l.label}
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// Fixed, non-cycled hue order for regions — same principle as CHANNEL_COLORS:
// a region keeps the same color everywhere it appears on this page.
const REGION_COLORS = ["#2f56c4", "#2563eb", "#059669", "#f2b000", "#7c3aed", "#0d9488", "#f97316", "#0f172a"];

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const PACE_TONE_BADGE = { red: "danger", yellow: "warning", green: "success" } as const;

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; year?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "executive:view_dashboard")) redirect("/dashboard");

  if (user.role === "FA_ADMIN") {
    return <FaExecutiveDashboard searchParams={searchParams} />;
  }

  const scopedOutletIds = await getScopedOutletIds(user.id, user.role);
  const outletScopeWhere = scopedOutletIds ? { id: { in: scopedOutletIds } } : {};
  const txOutletScopeWhere = scopedOutletIds ? { outletId: { in: scopedOutletIds } } : {};
  const settings = await getBusinessSettings();

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(today);
  monthStart.setDate(1);

  // The main figures below (channel breakdown, per-outlet/region bars,
  // pace tables) all follow this picked range — defaults to just today,
  // same as before. Week-to-date/Month-to-date stay fixed anchors since
  // those are inherently "as of now", not a range you'd pick.
  const { from, to } = await searchParams;
  const rangeFrom = from ? new Date(`${from}T00:00:00`) : new Date(today);
  rangeFrom.setHours(0, 0, 0, 0);
  const rangeTo = to ? new Date(`${to}T00:00:00`) : new Date(now);
  rangeTo.setHours(23, 59, 59, 999);
  const rangeIsToday = localDateKey(rangeFrom) === localDateKey(today) && localDateKey(rangeTo) === localDateKey(today);
  const rangeIsSingleDay = localDateKey(rangeFrom) === localDateKey(rangeTo);
  // Calendar-day count, not a raw millisecond diff — rangeTo is padded to
  // 23:59:59.999 for the DB query below, which would otherwise inflate this
  // by counting almost a full extra day.
  const rangeToStartOfDay = new Date(rangeTo);
  rangeToStartOfDay.setHours(0, 0, 0, 0);
  const rangeDays = Math.max(
    1,
    Math.round((rangeToStartOfDay.getTime() - rangeFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  const periodLabel = rangeIsSingleDay
    ? rangeFrom.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : `${rangeFrom.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${rangeTo.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
  // Trend chart spans the picked range itself (capped so a huge range
  // doesn't render an unreadable chart) instead of a fixed last-7-days.
  const trendStart = rangeIsToday ? new Date(new Date(today).setDate(today.getDate() - 6)) : new Date(rangeFrom);
  const trendEnd = rangeIsToday ? new Date(now) : new Date(rangeTo);
  const trendDayCount = Math.min(
    60,
    Math.max(1, Math.round((trendEnd.getTime() - trendStart.getTime()) / (1000 * 60 * 60 * 24)) + 1),
  );

  const [
    outlets,
    monthlyTargets,
    rangeByOutlet,
    rangeSum,
    weekSum,
    monthSum,
    channelRange,
    memberOmsetRange,
    monthItems,
    trendTransactions,
  ] = await Promise.all([
    prisma.outlet.findMany({ where: { status: "ACTIVE", ...outletScopeWhere }, include: { region: true } }),
    // Seasonal per-month targets (business-supplied) for the range's own
    // month — falls back to Outlet.dailyTarget below for any outlet/month
    // not yet loaded (e.g. a future year).
    prisma.outletMonthlyTarget.findMany({
      where: {
        year: rangeFrom.getFullYear(),
        month: rangeFrom.getMonth() + 1,
        ...(scopedOutletIds ? { outletId: { in: scopedOutletIds } } : {}),
      },
    }),
    prisma.transaction.groupBy({
      by: ["outletId"],
      where: { status: "COMPLETED", createdAt: { gte: rangeFrom, lte: rangeTo }, ...txOutletScopeWhere },
      _sum: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: rangeFrom, lte: rangeTo }, ...txOutletScopeWhere },
      _sum: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: weekStart }, ...txOutletScopeWhere },
      _sum: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: monthStart }, ...txOutletScopeWhere },
      _sum: { total: true },
    }),
    prisma.transaction.groupBy({
      by: ["channel"],
      where: { status: "COMPLETED", createdAt: { gte: rangeFrom, lte: rangeTo }, ...txOutletScopeWhere },
      _sum: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: rangeFrom, lte: rangeTo }, memberId: { not: null }, ...txOutletScopeWhere },
      _sum: { total: true },
    }),
    prisma.transactionItem.findMany({
      where: { transaction: { status: "COMPLETED", createdAt: { gte: monthStart }, ...txOutletScopeWhere } },
      include: { product: true },
    }),
    prisma.transaction.findMany({
      where: { status: "COMPLETED", createdAt: { gte: trendStart, lte: trendEnd }, ...txOutletScopeWhere },
      select: { total: true, createdAt: true },
    }),
  ]);

  const dailyTargetByOutlet = new Map(monthlyTargets.map((t) => [t.outletId, Number(t.dailyTarget)]));
  function currentDailyTarget(o: { id: string; dailyTarget: unknown }) {
    return dailyTargetByOutlet.get(o.id) ?? Number(o.dailyTarget);
  }

  const omsetByOutlet = new Map(rangeByOutlet.map((o) => [o.outletId, Number(o._sum.total ?? 0)]));
  const rangeOmset = Number(rangeSum._sum.total ?? 0);
  const weekOmset = Number(weekSum._sum.total ?? 0);
  const monthOmset = Number(monthSum._sum.total ?? 0);
  const totalDailyTarget = outlets.reduce((sum, o) => sum + currentDailyTarget(o), 0) * rangeDays;
  const achievementPct = totalDailyTarget > 0 ? Math.round((rangeOmset / totalDailyTarget) * 100) : 0;
  const memberOmset = Number(memberOmsetRange._sum.total ?? 0);
  const memberContributionPct = rangeOmset > 0 ? Math.round((memberOmset / rangeOmset) * 100) : 0;

  // "Pace vs target elapsed business hours" only means something for
  // today itself — a picked historical range (or multi-day range) is
  // judged on plain achievement % against its own (prorated) target instead.
  const elapsedFraction = elapsedBusinessFraction(now, settings);
  const outletPace = outlets.map((o) => {
    const actual = omsetByOutlet.get(o.id) ?? 0;
    const target = currentDailyTarget(o) * rangeDays;
    const tone = rangeIsToday
      ? classifyPace(actual, currentDailyTarget(o), elapsedFraction, settings)
      : target > 0
        ? actual / target >= 0.9
          ? "green"
          : actual / target >= 0.7
            ? "yellow"
            : "red"
        : "green";
    return {
      id: o.id,
      name: o.name,
      region: o.region.name,
      actual,
      target,
      tone,
    };
  });
  const alertCounts = {
    red: outletPace.filter((o) => o.tone === "red").length,
    yellow: outletPace.filter((o) => o.tone === "yellow").length,
    green: outletPace.filter((o) => o.tone === "green").length,
  };

  const regionMap = new Map<string, { name: string; omset: number; target: number }>();
  for (const o of outletPace) {
    const entry = regionMap.get(o.region) ?? { name: o.region, omset: 0, target: 0 };
    entry.omset += o.actual;
    entry.target += o.target;
    regionMap.set(o.region, entry);
  }
  const regionLeaderboard = Array.from(regionMap.values())
    .map((r) => ({ ...r, pct: r.target > 0 ? Math.round((r.omset / r.target) * 100) : 0 }))
    .sort((a, b) => b.omset - a.omset);

  const cashRange = Number(channelRange.find((c) => c.channel === "CASH")?._sum.total ?? 0);
  const nonTunaiRange = rangeOmset - cashRange;

  const channelDonutData = channelRange
    .map((c) => ({
      name: CHANNEL_LABELS[c.channel] ?? c.channel,
      value: Number(c._sum.total ?? 0),
      color: CHANNEL_COLORS[c.channel] ?? "#64748b",
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const regionColorByName = new Map(
    [...regionMap.keys()].sort().map((name, i) => [name, REGION_COLORS[i % REGION_COLORS.length]]),
  );
  const regionBarData = regionLeaderboard.map((r) => ({
    name: r.name,
    value: r.omset,
    color: regionColorByName.get(r.name),
  }));
  const outletBarData = [...outletPace]
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 10)
    .map((o) => ({ name: o.name, value: o.actual, color: regionColorByName.get(o.region) }));

  const productRevenue = new Map<string, { name: string; revenue: number }>();
  for (const item of monthItems) {
    const entry = productRevenue.get(item.productId) ?? { name: item.product.name, revenue: 0 };
    entry.revenue += Number(item.unitPrice) * item.qty;
    productRevenue.set(item.productId, entry);
  }
  const topProducts = Array.from(productRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const trendByDay = new Map<string, number>();
  for (const t of trendTransactions) {
    const key = localDateKey(t.createdAt);
    trendByDay.set(key, (trendByDay.get(key) ?? 0) + Number(t.total));
  }
  const trendData = Array.from({ length: trendDayCount }, (_, i) => {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    const key = localDateKey(d);
    return {
      date: key,
      label: d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }),
      omset: trendByDay.get(key) ?? 0,
    };
  });

  const currentMonthLabel = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <PageHeader
        title={scopedOutletIds ? "Regional Dashboard" : "Executive Dashboard"}
        description={
          (scopedOutletIds
            ? `Ringkasan operasional region Anda — ${outlets.length} outlet aktif.`
            : `Ringkasan operasional seluruh perusahaan — ${outlets.length} outlet aktif.`) +
          ` Periode: ${periodLabel}. Target harian mengikuti target musiman ${currentMonthLabel}.`
        }
        actions={<DateRangeFilter from={localDateKey(rangeFrom)} to={localDateKey(rangeTo)} />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={rangeIsSingleDay ? "Omset Periode Ini" : `Omset ${rangeDays} Hari Terpilih`}
          value={currency.format(rangeOmset)}
          tone="brand"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="vs Target Periode"
          value={`${achievementPct}%`}
          tone={achievementPct >= 90 ? "success" : achievementPct >= 70 ? "warning" : "danger"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard label="Week-to-date" value={currency.format(weekOmset)} tone="neutral" />
        <StatCard label="Month-to-date" value={currency.format(monthOmset)} tone="neutral" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Tunai" value={currency.format(cashRange)} tone="neutral" />
        <StatCard label="Non-Tunai" value={currency.format(nonTunaiRange)} tone="accent" />
        <StatCard
          label="Kontribusi Member"
          value={`${memberContributionPct}%`}
          tone="info"
          icon={<Users2 className="h-4 w-4" />}
        />
        <StatCard
          label="Outlet Bermasalah"
          value={String(alertCounts.red)}
          hint={`${alertCounts.yellow} perlu perhatian · ${alertCounts.green} on-track`}
          tone={alertCounts.red > 0 ? "danger" : "success"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rangeIsToday ? "Tren Omset 7 Hari Terakhir" : `Tren Omset — ${periodLabel}`}</CardTitle>
        </CardHeader>
        <div className="p-5 pt-2">
          <OmsetTrendChart data={trendData} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Breakdown Channel — {periodLabel}</CardTitle>
          </CardHeader>
          <div className="p-5">
            <FormattedDonutChart data={channelDonutData} format="currency" centerLabel="Total" />
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{scopedOutletIds ? "Omset per Outlet" : "Omset per Region"} — {periodLabel}</CardTitle>
          </CardHeader>
          <div className="p-5">
            <FormattedBarChart data={scopedOutletIds ? outletBarData : regionBarData} format="currency" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regional Performance — {periodLabel}</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Region</Th>
              <Th>Omset</Th>
              <Th>Target</Th>
              <Th>Achievement</Th>
            </tr>
          </Thead>
          <tbody>
            {regionLeaderboard.map((r) => (
              <Tr key={r.name}>
                <Td className="font-medium text-slate-900">{r.name}</Td>
                <Td>{currency.format(r.omset)}</Td>
                <Td>{currency.format(r.target)}</Td>
                <Td>
                  <Badge tone={r.pct >= 90 ? "success" : r.pct >= 70 ? "warning" : "danger"}>{r.pct}%</Badge>
                </Td>
              </Tr>
            ))}
            {regionLeaderboard.length === 0 && <EmptyRow colSpan={4}>Belum ada data region.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {rangeIsToday ? "Outlet Pace vs Target (jam operasional 09:00–21:00)" : `Outlet Achievement — ${periodLabel}`}
          </CardTitle>
          <ExportCsvButton
            rows={outletPace.map((o) => ({
              Outlet: o.name,
              Region: o.region,
              Omset: o.actual,
              Target: o.target,
              Status: o.tone,
            }))}
            filename="outlet-pace.csv"
          />
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Outlet</Th>
              <Th>Region</Th>
              <Th>Omset</Th>
              <Th>Target</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </Thead>
          <tbody>
            {outletPace
              .sort((a, b) => a.tone.localeCompare(b.tone))
              .map((o) => (
                <Tr key={o.id}>
                  <Td className="font-medium text-slate-900">{o.name}</Td>
                  <Td>{o.region}</Td>
                  <Td>{currency.format(o.actual)}</Td>
                  <Td>{currency.format(o.target)}</Td>
                  <Td>
                    <Badge tone={PACE_TONE_BADGE[o.tone]}>
                      {o.tone === "red" ? "Di bawah pace" : o.tone === "yellow" ? "Perlu perhatian" : "On track"}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/region-summary/${o.id}?${
                        // Dashboard Sales defaults to "today" when no range is
                        // picked — that's the right default for a live pace
                        // dashboard, but linking it straight into the ledger
                        // would show a single all-zero day before anything's
                        // sold yet. Only carry the range through when the
                        // user actually picked one; otherwise let the ledger
                        // fall back to its own default (current month).
                        from && to ? `from=${from}&to=${to}&` : ""
                      }showPramuniaga=false&back=executive`}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-accent-50 px-2.5 py-1.5 text-xs font-bold text-accent-700 hover:bg-accent-100"
                    >
                      Ledger Summary <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Td>
                </Tr>
              ))}
            {outletPace.length === 0 && <EmptyRow colSpan={6}>Belum ada outlet aktif.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 Produk (Month-to-date, by revenue)</CardTitle>
        </CardHeader>
        <div className="p-5">
          <FormattedBarChart
            data={topProducts.map((p) => ({ name: p.name, value: p.revenue }))}
            format="currency"
            defaultColor="#f2b000"
          />
        </div>
        <Table>
          <Thead>
            <tr>
              <Th>Produk</Th>
              <Th>Revenue</Th>
            </tr>
          </Thead>
          <tbody>
            {topProducts.map((p) => (
              <Tr key={p.name}>
                <Td className="font-medium text-slate-900">{p.name}</Td>
                <Td>{currency.format(p.revenue)}</Td>
              </Tr>
            ))}
            {topProducts.length === 0 && <EmptyRow colSpan={2}>Belum ada penjualan bulan ini.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
