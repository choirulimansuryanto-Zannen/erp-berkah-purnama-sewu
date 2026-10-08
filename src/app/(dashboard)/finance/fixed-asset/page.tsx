import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { Wallet, TrendingDown, Landmark } from "lucide-react";
import { getFixedAssetSchedule } from "@/lib/fixed-asset";

const MONTH_LABELS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

// Fixed Asset — the itemized asset register (one row per physical asset)
// supporting Neraca's "Asset Tetap" / "Akumulasi Penyusutan" summary lines.
// Straight-line depreciation is computed live for whichever year is
// selected (see src/lib/fixed-asset.ts) — same year-selector convention as
// Neraca: shows Jan..current-month for this year, full Jan-Dec for a past
// year. NOT yet wired into the ledger/Jurnal Penyesuaian — informational
// register for tracking individual assets.
export default async function FixedAssetPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const { groups, grandTotal, monthCount } = await getFixedAssetSchedule(year, month);
  const monthLabels = MONTH_LABELS_ID.slice(0, monthCount);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixed Asset"
        description="Daftar aset tetap per unit — nilai perolehan, dasar penyusutan (PT), penyusutan bulanan, akumulasi penyusutan, dan nilai buku (Economic Value). Belum terhubung ke jurnal — register pelacakan per aset, terpisah dari posting Jurnal Penyesuaian."
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
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
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Nilai Perolehan" value={currency.format(grandTotal.acquisitionAmount)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Dasar Penyusutan (PT)" value={currency.format(grandTotal.depreciableBase)} tone="neutral" icon={<Landmark className="h-4 w-4" />} />
        <StatCard
          label="Akumulasi Penyusutan"
          value={currency.format(grandTotal.accumulatedDepreciation)}
          tone="warning"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard label="Economic Value (Nilai Buku)" value={currency.format(grandTotal.economicValue)} tone="success" icon={<Wallet className="h-4 w-4" />} />
      </div>

      <Card className="p-0" id="fixed-asset-section">
        <CardHeader className="sticky top-16 z-30 h-14 bg-white">
          <CardTitle>Daftar Aset Tetap — {year}</CardTitle>
          <ExportExcelButton containerId="fixed-asset-section" filename={`Fixed_Asset_${year}.xlsx`} />
        </CardHeader>

        <div className="overflow-x-auto" data-sheet-name="Fixed Asset">
          <div className="max-h-[75vh] overflow-y-auto">
            <table className="w-full min-w-[1600px] border-collapse text-xs">
              <thead className="sticky top-0 z-20">
                <tr className="bg-brand-950 text-white">
                  <th rowSpan={2} className="sticky left-0 z-30 border-r border-brand-900 bg-brand-950 px-2 py-2 text-left">
                    No
                  </th>
                  <th rowSpan={2} className="sticky left-8 z-30 min-w-[220px] border-r border-brand-900 bg-brand-950 px-3 py-2 text-left">
                    Asset Description
                  </th>
                  <th rowSpan={2} className="min-w-[130px] border-r border-brand-900 px-3 py-2 text-right">
                    Acquisition Amount
                  </th>
                  <th rowSpan={2} className="min-w-[130px] border-r border-brand-900 px-3 py-2 text-right">
                    PT
                  </th>
                  <th rowSpan={2} className="min-w-[120px] border-r border-brand-900 bg-gold-600 px-3 py-2 text-right text-brand-950">
                    {year}
                  </th>
                  <th colSpan={monthCount} className="border-r border-brand-900 bg-gold-600 px-3 py-2 text-center text-brand-950">
                    {year}
                  </th>
                  <th rowSpan={2} className="min-w-[120px] border-r border-brand-900 bg-gold-600 px-3 py-2 text-right text-brand-950">
                    {year}
                  </th>
                  <th rowSpan={2} className="min-w-[140px] border-r border-brand-900 px-3 py-2 text-right">
                    Accum Depreciation Expense
                  </th>
                  <th rowSpan={2} className="min-w-[130px] border-r border-brand-900 px-3 py-2 text-right">
                    Economic Value
                  </th>
                  <th rowSpan={2} className="min-w-[140px] px-3 py-2 text-left">
                    Remark
                  </th>
                </tr>
                <tr className="bg-gold-500 text-brand-950">
                  {monthLabels.map((m) => (
                    <th key={m} className="border-r border-gold-600 px-2 py-1.5 text-right font-semibold">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows key={g.category} group={g} monthCount={monthCount} />
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={monthCount + 9} className="px-3 py-6 text-center text-slate-400">
                      Belum ada data aset tetap.
                    </td>
                  </tr>
                )}
              </tbody>
              {groups.length > 0 && (
                <tfoot>
                  <tr className="bg-brand-900 font-bold text-white">
                    <td colSpan={2} className="sticky left-0 z-10 bg-brand-900 px-3 py-2">
                      TOTAL
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{currency.format(grandTotal.acquisitionAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{currency.format(grandTotal.depreciableBase)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{currency.format(grandTotal.yearToDateTotal)}</td>
                    {grandTotal.months.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right tabular-nums">
                        {currency.format(v)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums">{currency.format(grandTotal.yearToDateTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{currency.format(grandTotal.accumulatedDepreciation)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{currency.format(grandTotal.economicValue)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}

function GroupRows({
  group,
  monthCount,
}: {
  group: Awaited<ReturnType<typeof getFixedAssetSchedule>>["groups"][number];
  monthCount: number;
}) {
  return (
    <>
      <tr className="bg-slate-100">
        <td colSpan={monthCount + 9} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-900">
          {group.label}
        </td>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-gold-50/40">
          <td className="sticky left-0 z-10 bg-inherit px-2 py-1.5 tabular-nums text-slate-400">{r.no ?? "-"}</td>
          <td className="sticky left-8 z-10 bg-inherit px-3 py-1.5 font-medium text-slate-900">{r.description}</td>
          <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(r.acquisitionAmount)}</td>
          <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(r.depreciableBase)}</td>
          <td className="px-3 py-1.5 text-right tabular-nums">{r.yearToDateTotal > 0 ? currency.format(r.yearToDateTotal) : "-"}</td>
          {Array.from({ length: monthCount }, (_, i) => r.months[i] ?? 0).map((v, i) => (
            <td key={i} className="px-2 py-1.5 text-right tabular-nums">
              {v > 0 ? currency.format(v) : "-"}
            </td>
          ))}
          <td className="px-3 py-1.5 text-right tabular-nums">{r.yearToDateTotal > 0 ? currency.format(r.yearToDateTotal) : "-"}</td>
          <td className="bg-gold-50/40 px-3 py-1.5 text-right font-semibold tabular-nums text-brand-900">{currency.format(r.accumulatedDepreciation)}</td>
          <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(r.economicValue)}</td>
          <td className="px-3 py-1.5 text-slate-500">{r.fullyDepreciated ? "Fully depreciated" : r.remark ?? ""}</td>
        </tr>
      ))}
      <tr className="bg-gold-50 font-bold text-brand-900">
        <td colSpan={2} className="sticky left-0 z-10 bg-gold-50 px-3 py-1.5">
          TOTAL {group.label}
        </td>
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.acquisitionAmount)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.depreciableBase)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.yearToDateTotal)}</td>
        {Array.from({ length: monthCount }, (_, i) => group.totals.months[i] ?? 0).map((v, i) => (
          <td key={i} className="px-2 py-1.5 text-right tabular-nums">
            {currency.format(v)}
          </td>
        ))}
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.yearToDateTotal)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.accumulatedDepreciation)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.economicValue)}</td>
        <td />
      </tr>
    </>
  );
}
