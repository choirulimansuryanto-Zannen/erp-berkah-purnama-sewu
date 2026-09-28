import { redirect } from "next/navigation";
import Link from "next/link";
import { Target, TrendingUp, Wallet, Store, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAchievementTier, type AchievementZone } from "@/lib/outlet-achievement";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FormattedBarChart, FormattedDonutChart } from "@/components/ui/formatted-charts";
import { DateRangeFilter } from "@/components/ui/date-range-filter";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ZONE_BADGE: Record<AchievementZone, "success" | "warning" | "danger"> = {
  HIJAU: "success",
  KUNING: "warning",
  JINGGA: "warning",
  MERAH: "danger",
  HITAM: "danger",
};
const ZONE_BAR_COLOR: Record<AchievementZone, string> = {
  HIJAU: "#059669",
  KUNING: "#f2b000",
  JINGGA: "#f97316",
  MERAH: "#d92a1c",
  HITAM: "#1e293b",
};

// The pramuniaga's own "Ringkasan Outlet" (achievement vs monthly target),
// widened to every outlet in this SPV's region plus a region-wide rollup —
// same underlying target/achievement math (getAchievementTier), applied
// once per outlet instead of once for the pramuniaga's single outlet.
export default async function RegionSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "SPV") redirect("/dashboard");

  const now = new Date();
  const { from, to } = await searchParams;
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeFrom = from ? new Date(`${from}T00:00:00`) : defaultFrom;
  rangeFrom.setHours(0, 0, 0, 0);
  const rangeTo = to ? new Date(`${to}T00:00:00`) : now;
  rangeTo.setHours(23, 59, 59, 999);
  const rangeToStartOfDay = new Date(rangeTo);
  rangeToStartOfDay.setHours(0, 0, 0, 0);
  const rangeDays = Math.max(
    1,
    Math.round((rangeToStartOfDay.getTime() - rangeFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  const isSameDay = localDateStr(rangeFrom) === localDateStr(rangeTo);
  const periodLabel = isSameDay
    ? rangeFrom.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : `${rangeFrom.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} – ${rangeTo.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  const regions = await prisma.region.findMany({ where: { spvId: user.id }, include: { outlets: true } });
  const outlets = regions.flatMap((r) => r.outlets);
  const outletIds = outlets.map((o) => o.id);

  // Targets are stored monthly (seasonal overrides in OutletMonthlyTarget,
  // else the outlet's own flat rate) — for an arbitrary picked range this
  // is prorated as dailyTarget × number of days selected, using whichever
  // month the range's start date falls in as the applicable rate.
  const [monthlyTargets, rangeTransactions] = await Promise.all([
    prisma.outletMonthlyTarget.findMany({
      where: { outletId: { in: outletIds }, year: rangeFrom.getFullYear(), month: rangeFrom.getMonth() + 1 },
    }),
    prisma.transaction.findMany({
      where: { outletId: { in: outletIds }, status: "COMPLETED", createdAt: { gte: rangeFrom, lte: rangeTo } },
      select: { outletId: true, total: true },
    }),
  ]);

  const dailyTargetByOutlet = new Map(monthlyTargets.map((t) => [t.outletId, Number(t.dailyTarget)]));
  const omsetByOutlet = new Map<string, number>();
  for (const t of rangeTransactions) omsetByOutlet.set(t.outletId, (omsetByOutlet.get(t.outletId) ?? 0) + Number(t.total));

  const outletRows = outlets.map((o) => {
    const omset = omsetByOutlet.get(o.id) ?? 0;
    const dailyRate = dailyTargetByOutlet.get(o.id) ?? Number(o.dailyTarget);
    const target = dailyRate * rangeDays;
    const pct = target > 0 ? Math.round((omset / target) * 100) : 0;
    const tier = getAchievementTier(pct, omset);
    return { id: o.id, name: o.name, omset, target, pct, tier };
  });

  const totalOmset = outletRows.reduce((s, o) => s + o.omset, 0);
  const totalTarget = outletRows.reduce((s, o) => s + o.target, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalOmset / totalTarget) * 100) : 0;

  const zoneCounts = outletRows.reduce(
    (acc, o) => {
      acc[o.tier.zone] = (acc[o.tier.zone] ?? 0) + 1;
      return acc;
    },
    {} as Record<AchievementZone, number>,
  );
  const zoneDonutData = (Object.entries(zoneCounts) as [AchievementZone, number][]).map(([zone, count]) => ({
    name: zone,
    value: count,
    color: ZONE_BAR_COLOR[zone],
  }));

  const barData = [...outletRows]
    .sort((a, b) => b.pct - a.pct)
    .map((o) => ({ name: o.name, value: o.pct, color: ZONE_BAR_COLOR[o.tier.zone] }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan Wilayah"
        description={`Achievement wilayah terhadap target (diprorata per hari) — ${periodLabel} · ${outlets.length} outlet.`}
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Omset Periode Ini" value={currency.format(totalOmset)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Target Periode Ini" value={currency.format(totalTarget)} tone="neutral" icon={<Target className="h-4 w-4" />} />
        <StatCard
          label="Achievement Wilayah"
          value={`${overallPct}%`}
          tone={overallPct >= 90 ? "success" : overallPct >= 70 ? "warning" : "danger"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard label="Jumlah Outlet" value={String(outlets.length)} tone="accent" icon={<Store className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Achievement % per Outlet ({periodLabel})</CardTitle>
          </CardHeader>
          <div className="p-5">
            <FormattedBarChart data={barData} format="percent" />
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Distribusi Zona Outlet</CardTitle>
          </CardHeader>
          <div className="p-5">
            <FormattedDonutChart data={zoneDonutData} unit="outlet" centerLabel="Outlet" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Detail per Outlet</CardTitle>
            <p className="mt-0.5 text-xs text-slate-400">Klik "Lihat Ledger Harian" untuk rincian omset, TC, dan APC per hari.</p>
          </div>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Outlet</Th>
              <Th>Omset Periode Ini</Th>
              <Th>Target Periode Ini</Th>
              <Th>Achievement</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </Thead>
          <tbody>
            {outletRows
              .sort((a, b) => a.pct - b.pct)
              .map((o) => (
                <Tr key={o.id}>
                  <Td className="font-medium text-slate-900">{o.name}</Td>
                  <Td>{currency.format(o.omset)}</Td>
                  <Td>{currency.format(o.target)}</Td>
                  <Td>
                    <Badge tone={ZONE_BADGE[o.tier.zone]}>{o.pct}%</Badge>
                  </Td>
                  <Td className="text-xs text-slate-500">{o.tier.statusLabel}</Td>
                  <Td>
                    <Link
                      href={`/region-summary/${o.id}?from=${localDateStr(rangeFrom)}&to=${localDateStr(rangeTo)}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-accent-50 px-2.5 py-1.5 text-xs font-bold text-accent-700 hover:bg-accent-100"
                    >
                      Lihat Ledger Harian <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Td>
                </Tr>
              ))}
            {outletRows.length === 0 && <EmptyRow colSpan={6}>Belum ada outlet di wilayah Anda.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
