import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { RunCalculationButton } from "@/components/finance/run-calculation-button";
import { INCENTIVE_TYPE_LABELS, INCENTIVE_SCOPE_LABELS, INCENTIVE_BASIS_LABELS } from "@/lib/incentive";
import { getCompanyDailyIncentiveBreakdown, HARI_NAMES } from "@/lib/outlet-report";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const number0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const SHIFT_LABELS: Record<string, string> = { SHIFT_1: "Shift 1", SHIFT_2: "Shift 2", FULLSHIFT: "Fullshift" };

// Laporan Insentive — company-wide summary across all 10 incentive types
// (Pramu/Pengelola per outlet, SPV per wilayah, everything else company-
// wide), for one selected month. Figures come from IncentiveCalculation
// rows produced by src/lib/incentive.ts — "Hitung Ulang" re-runs it against
// the current rate table and this month's Omset/Laba figures.
export default async function InsentifPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam, month: monthParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const [calculations, dailyRows] = await Promise.all([
    prisma.incentiveCalculation.findMany({
      where: { year, month },
      include: { outlet: { select: { name: true } }, region: { select: { name: true } } },
      orderBy: [{ scope: "asc" }, { type: "asc" }],
    }),
    getCompanyDailyIncentiveBreakdown(year, month),
  ]);

  const dailySummaryByPerson = new Map<string, { name: string; total: number; days: Set<string> }>();
  for (const r of dailyRows) {
    const entry = dailySummaryByPerson.get(r.pramuniagaKey) ?? { name: r.pramuniagaName, total: 0, days: new Set<string>() };
    entry.total += r.insentifPerPramu;
    entry.days.add(`${r.date.toISOString().slice(0, 10)}|${r.outletName}`);
    dailySummaryByPerson.set(r.pramuniagaKey, entry);
  }
  const dailySummary = [...dailySummaryByPerson.values()]
    .map((v) => ({ name: v.name, total: v.total, hariKerja: v.days.size }))
    .sort((a, b) => b.total - a.total);
  const dailyGrandTotal = dailyRows.reduce((s, r) => s + r.insentifPerPramu, 0);

  const byType = new Map<string, { total: number; count: number }>();
  for (const c of calculations) {
    const entry = byType.get(c.type) ?? { total: 0, count: 0 };
    entry.total += Number(c.amount);
    entry.count += 1;
    byType.set(c.type, entry);
  }
  const grandTotal = calculations.reduce((s, c) => s + Number(c.amount), 0);
  const outletCount = new Set(calculations.filter((c) => c.outletId).map((c) => c.outletId)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Insentif"
        description="Summary seluruh perhitungan insentif — Pramu, SPV, Pengelola, Officer/Head Sales, Officer/Head Marketing, Head FA, Head Operasional, Management."
        actions={
          <Link href="/admin/incentive-rules" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-700 hover:text-accent-800">
            <Settings className="h-3.5 w-3.5" /> Atur Rate
          </Link>
        }
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label className="text-[11px]">Bulan</Label>
            <Select name="month" defaultValue={String(month)} className="mt-1">
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
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
          <div className="ml-auto">
            <RunCalculationButton endpoint="/api/finance/incentive-calculations" year={year} month={month} />
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={`Total Insentif ${MONTH_NAMES[month - 1]} ${year}`} value={currency.format(grandTotal)} tone="brand" icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Outlet Dihitung" value={String(outletCount)} tone="accent" />
        <StatCard label="Jenis Insentif Aktif" value={`${byType.size}/10`} tone="info" />
        <StatCard label="Baris Perhitungan" value={String(calculations.length)} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan per Jenis</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Jenis Insentif</Th>
              <Th>Lingkup</Th>
              <Th className="text-right">Jumlah Target</Th>
              <Th className="text-right">Total Nominal</Th>
            </tr>
          </Thead>
          <tbody>
            {Object.entries(INCENTIVE_TYPE_LABELS).map(([type, label]) => {
              const entry = byType.get(type);
              const sample = calculations.find((c) => c.type === type);
              return (
                <Tr key={type}>
                  <Td className="font-medium text-slate-900">{label}</Td>
                  <Td>{sample ? INCENTIVE_SCOPE_LABELS[sample.scope] : "-"}</Td>
                  <Td className="text-right">{entry?.count ?? 0}</Td>
                  <Td className="text-right font-semibold">{currency.format(entry?.total ?? 0)}</Td>
                </Tr>
              );
            })}
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td colSpan={3}>TOTAL INSENTIF</Td>
              <Td className="text-right">{currency.format(grandTotal)}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rincian per Target ({calculations.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Jenis</Th>
              <Th>Target</Th>
              <Th>Basis</Th>
              <Th className="text-right">Rate</Th>
              <Th className="text-right">Dasar Perhitungan</Th>
              <Th className="text-right">Nominal Insentif</Th>
            </tr>
          </Thead>
          <tbody>
            {calculations.map((c) => (
              <Tr key={c.id}>
                <Td>{INCENTIVE_TYPE_LABELS[c.type]}</Td>
                <Td className="text-xs text-slate-500">{c.outlet?.name ?? c.region?.name ?? "Perusahaan"}</Td>
                <Td>
                  <Badge tone="info">{INCENTIVE_BASIS_LABELS[c.basis]}</Badge>
                </Td>
                <Td className="text-right">{c.basis === "NOMINAL_TETAP" ? currency.format(Number(c.rateSnapshot)) : `${Number(c.rateSnapshot)}%`}</Td>
                <Td className="text-right">{currency.format(Number(c.baseAmount))}</Td>
                <Td className="text-right font-semibold">{currency.format(Number(c.amount))}</Td>
              </Tr>
            ))}
            {calculations.length === 0 && (
              <EmptyRow colSpan={6}>Belum dihitung untuk periode ini — klik &quot;Hitung Ulang Bulan Ini&quot; di atas.</EmptyRow>
            )}
          </tbody>
        </Table>
      </Card>

      {/* Perincian Insentif Harian — the same bracket/roster math each
          outlet's own Insentive Sheet uses, flattened across every active
          outlet so this one table is the whole company's day-by-day
          incentive audit trail (who, where, which bracket, how much). */}
      <Card className="p-0">
        <CardHeader className="sticky top-16 z-30 h-14 bg-white">
          <CardTitle>Perincian Insentif Harian — Seluruh Pramuniaga ({dailyRows.length})</CardTitle>
        </CardHeader>
        <Table wrapperClassName="max-h-[70vh] overflow-y-auto">
          <Thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <Th>Tanggal</Th>
              <Th>Outlet</Th>
              <Th className="text-right">Omset</Th>
              <Th className="text-right">%</Th>
              <Th>Plafon Insentif</Th>
              <Th>Pramuniaga</Th>
              <Th>Shift</Th>
              <Th className="text-right">Qty Pramuniaga</Th>
              <Th className="text-right">Insentif Per Pramu</Th>
            </tr>
          </Thead>
          <tbody>
            {dailyRows.map((r, i) => (
              <Tr key={i}>
                <Td>
                  {HARI_NAMES[r.date.getUTCDay()]}, {r.date.toLocaleDateString("id-ID")}
                </Td>
                <Td className="font-medium text-slate-900">{r.outletName}</Td>
                <Td className="text-right tabular-nums">{currency.format(r.omset)}</Td>
                <Td className="text-right tabular-nums">{r.ratePercent > 0 ? `${number0.format(r.ratePercent)}%` : "-"}</Td>
                <Td className="text-xs text-slate-500">{r.plafonLabel}</Td>
                <Td>{r.pramuniagaName}</Td>
                <Td>
                  <Badge tone="neutral">{SHIFT_LABELS[r.shift] ?? r.shift}</Badge>
                </Td>
                <Td className="text-right tabular-nums">{r.qtyPramuniaga}</Td>
                <Td className="text-right font-semibold tabular-nums">{r.insentifPerPramu > 0 ? currency.format(r.insentifPerPramu) : "-"}</Td>
              </Tr>
            ))}
            {dailyRows.length === 0 && <EmptyRow colSpan={9}>Belum ada data kehadiran/omset pada periode ini.</EmptyRow>}
          </tbody>
          {dailyRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-brand-900">
                <td className="px-5 py-2.5" colSpan={8}>
                  Total Insentif Harian (seluruh pramuniaga, seluruh outlet)
                </td>
                <td className="px-5 py-2.5 text-right">{currency.format(dailyGrandTotal)}</td>
              </tr>
            </tfoot>
          )}
        </Table>
      </Card>

      {/* Summary keseluruhan — total insentif per pramuniaga for the month,
          derived from the exact same rows shown above (never a separate
          re-calculation), so the two tables can never disagree. */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Insentif per Pramuniaga — {MONTH_NAMES[month - 1]} {year} ({dailySummary.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama Pramuniaga</Th>
              <Th className="text-right">Hari Kerja Dapat Insentif</Th>
              <Th className="text-right">Total Insentif Bulan Ini</Th>
            </tr>
          </Thead>
          <tbody>
            {dailySummary.map((s) => (
              <Tr key={s.name}>
                <Td className="font-medium text-slate-900">{s.name}</Td>
                <Td className="text-right tabular-nums">{s.hariKerja}</Td>
                <Td className="text-right font-semibold tabular-nums">{currency.format(s.total)}</Td>
              </Tr>
            ))}
            {dailySummary.length === 0 && <EmptyRow colSpan={3}>Belum ada data pada periode ini.</EmptyRow>}
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td colSpan={2}>TOTAL</Td>
              <Td className="text-right tabular-nums">{currency.format(dailyGrandTotal)}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
