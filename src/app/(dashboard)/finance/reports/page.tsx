import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getMonthlyAccountMatrix,
  getMonthlyHppReport,
  computeLabaBersihSeries,
  accountSubtree,
  typeNaturalValue,
  REVENUE_GROUPS,
  PAJAK_PENGHASILAN_CODE,
  type MonthlyAccountRow,
} from "@/lib/accounting";
import { MonthlyReportTable, type MonthlyReportRow } from "@/components/finance/monthly-report-table";

const ZERO_12 = () => Array.from({ length: 12 }, () => 0);
function negate(values: number[]): number[] {
  return values.map((v) => -v);
}
function addSeries(...series: number[][]): number[] {
  return ZERO_12().map((_, i) => series.reduce((s, arr) => s + arr[i], 0));
}
/** Every account's monthly movement, re-signed into its TYPE's natural
 * direction (see typeNaturalValue) — the shared basis for both a group's
 * line-item rows and its subtotal, so the two are never derived two
 * different ways. */
function naturalMonthly(a: MonthlyAccountRow): number[] {
  return a.monthly.map((v) => typeNaturalValue(v, a.type, a.normalBalance));
}

// Laba Rugi — the Neraca lives on its own page (/finance/neraca) since the
// two used to share one screen and stakeholder feedback asked for them
// split; computeLabaBersihSeries is still the one shared source both pages
// read "Laba (Rugi) Tahun Berjalan" from, so the two can never disagree.
export default async function FinanceReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;

  const [matrix, hppReport] = await Promise.all([getMonthlyAccountMatrix(year), getMonthlyHppReport(year)]);

  function groupSubtree(parentCode: string) {
    return accountSubtree(matrix, parentCode);
  }
  function groupTotal(parentCode: string): number[] {
    return addSeries(...groupSubtree(parentCode).map(naturalMonthly));
  }
  function groupLineRows(parentCode: string, negative = false): MonthlyReportRow[] {
    return groupSubtree(parentCode)
      .filter((a) => a.code !== parentCode && a.monthly.some((v) => v !== 0))
      .map((a) => ({ code: a.code, label: a.name, values: naturalMonthly(a), indent: true, negative }));
  }

  // Total Penjualan → Dikurangi HPP → Laba Kotor → Beban Operasional →
  // Laba Operasi → Pendapatan/Beban Non Operasi → Laba Sebelum Pajak →
  // Pajak Penghasilan → Laba Setelah Accrual.
  const laraRugiRows: MonthlyReportRow[] = [];
  const revenueGroupTotals: number[][] = [];
  for (const g of REVENUE_GROUPS) {
    const total = groupTotal(g.code);
    revenueGroupTotals.push(total);
    laraRugiRows.push({ label: g.label, values: total, style: "subtotal" });
    laraRugiRows.push(...groupLineRows(g.code));
  }
  const totalPenjualan = addSeries(...revenueGroupTotals);
  laraRugiRows.push({ label: "TOTAL PENJUALAN", values: totalPenjualan, style: "total" });

  // Cash-basis, not the accrual-adjusted figure Laporan HPP itself
  // headlines — this ERP is deliberately cash-basis throughout (every
  // JournalEntry always touches a real cash book), and a stock-opname
  // "Persediaan Akhir" has no corresponding ChartOfAccount asset ever
  // debited for it, so using the accrual figure here would shrink the
  // expense side with no matching asset anywhere on the Neraca to balance
  // against. See the cashBasisHpp doc comment in accounting.ts.
  const totalHpp = hppReport.cashBasisHpp;
  laraRugiRows.push({ label: "Dikurangi HPP (Basis Kas — lihat Laporan HPP untuk basis akrual)", values: totalHpp, style: "subtotal", negative: true });
  const labaKotor = addSeries(totalPenjualan, negate(totalHpp));
  laraRugiRows.push({ label: "LABA KOTOR", values: labaKotor, style: "total" });

  const totalBebanOperasional = groupTotal("60000");
  laraRugiRows.push({ label: "BEBAN OPERASIONAL", values: totalBebanOperasional, style: "subtotal", negative: true });
  laraRugiRows.push(...groupLineRows("60000", true));
  const labaOperasi = addSeries(labaKotor, negate(totalBebanOperasional));
  laraRugiRows.push({ label: "LABA OPERASI", values: labaOperasi, style: "total" });

  const totalPendapatanNonOp = groupTotal("70000");
  laraRugiRows.push({ label: "PENDAPATAN NON OPERASI", values: totalPendapatanNonOp, style: "subtotal" });
  laraRugiRows.push(...groupLineRows("70000"));

  const totalBebanNonOp = groupTotal("80000");
  laraRugiRows.push({ label: "BEBAN NON OPERASI", values: totalBebanNonOp, style: "subtotal", negative: true });
  laraRugiRows.push(...groupLineRows("80000", true));

  const labaSebelumPajak = addSeries(labaOperasi, totalPendapatanNonOp, negate(totalBebanNonOp));
  laraRugiRows.push({ label: "LABA TAHUN BERJALAN SEBELUM PAJAK", values: labaSebelumPajak, style: "total" });

  const pajakAccount = matrix.find((a) => a.code === PAJAK_PENGHASILAN_CODE);
  const pajakPenghasilan = pajakAccount ? naturalMonthly(pajakAccount) : ZERO_12();
  laraRugiRows.push({ label: "Pajak Penghasilan", values: pajakPenghasilan, style: "subtotal", negative: true });

  // Sourced from the shared engine (not re-derived here) so this row is
  // GUARANTEED to match the Neraca page's own "Laba Berjalan" carry-forward
  // — two independent computations of the same figure is exactly the kind
  // of drift that caused an earlier Neraca-imbalance bug.
  const labaBersih = computeLabaBersihSeries(matrix, hppReport.cashBasisHpp);
  laraRugiRows.push({ label: "LABA TAHUN BERJALAN SETELAH ACCRUAL", values: labaBersih, style: "total" });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laba Rugi"
        description="Setiap akun tampil satu per satu, dibandingkan per bulan Januari–Desember. HPP dibahas terperinci di Laporan HPP; posisi keuangan di Neraca."
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

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Laba Rugi — {year} (per bulan)</p>
        </div>
        <MonthlyReportTable rows={laraRugiRows} year={year} upToMonth={upToMonth} totalLabel={`Total ${year}`} />
      </Card>
    </div>
  );
}
