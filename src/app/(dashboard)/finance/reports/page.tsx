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
  ACCOUNT_TYPE_LABELS,
  typeNaturalValue,
  REVENUE_GROUPS,
  PAJAK_PENGHASILAN_CODE,
  type MonthlyAccountRow,
} from "@/lib/accounting";
import { MonthlyReportTable, type MonthlyReportRow } from "@/components/finance/monthly-report-table";
import type { AccountType } from "@prisma/client";

const ZERO_12 = () => Array.from({ length: 12 }, () => 0);
function sumRows(rows: MonthlyReportRow[]): number[] {
  const out = ZERO_12();
  for (const r of rows) r.values.forEach((v, i) => (out[i] += v));
  return out;
}
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

  // ── Laba Rugi — Total Penjualan → Dikurangi HPP → Laba Kotor → Beban
  // Operasional → Laba Operasi → Pendapatan/Beban Non Operasi → Laba
  // Sebelum Pajak → Pajak Penghasilan → Laba Setelah Accrual. ────────────
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
  // GUARANTEED to match the Neraca's own "Laba Berjalan" carry-forward —
  // two independent computations of the same figure is exactly the kind of
  // drift that caused an earlier Neraca-imbalance bug.
  const labaBersih = computeLabaBersihSeries(matrix, hppReport.cashBasisHpp);
  laraRugiRows.push({ label: "LABA TAHUN BERJALAN SETELAH ACCRUAL", values: labaBersih, style: "total" });

  // ── Neraca (cumulative — end-of-month balances) ──────────────────────
  function neracaAccountRows(type: AccountType): MonthlyReportRow[] {
    return matrix
      .filter((a) => a.type === type && a.cumulative.some((v) => v !== 0))
      .map((a) => ({
        code: a.code,
        label: a.name,
        values: a.cumulative.map((v) => typeNaturalValue(v, a.type, a.normalBalance)),
        indent: true,
      }));
  }

  const asetRows = neracaAccountRows("ASET");
  const kewajibanRows = neracaAccountRows("KEWAJIBAN");
  const ekuitasRecordedRows = neracaAccountRows("EKUITAS");
  const totalAset = sumRows(asetRows);
  const totalKewajiban = sumRows(kewajibanRows);
  const totalEkuitasRecorded = sumRows(ekuitasRecordedRows);
  // Laba berjalan (undistributed, since no period-close step exists) folds
  // into Ekuitas as its own running YTD line — the Neraca is a cumulative
  // (point-in-time) report, so this must be labaBersih *running-summed*,
  // not the raw per-month figure Laba Rugi itself shows.
  let runningLaba = 0;
  const labaBerjalanCumulative = labaBersih.map((v) => {
    runningLaba += v;
    return runningLaba;
  });
  const labaBerjalanRow: MonthlyReportRow = {
    label: "Laba (Rugi) Berjalan (belum ditutup)",
    values: labaBerjalanCumulative,
    indent: true,
  };
  const totalEkuitas = addSeries(totalEkuitasRecorded, labaBerjalanCumulative);
  const totalKewajibanEkuitas = addSeries(totalKewajiban, totalEkuitas);

  const neracaRows: MonthlyReportRow[] = [
    { label: ACCOUNT_TYPE_LABELS.ASET, values: totalAset, style: "subtotal" },
    ...asetRows,
    { label: ACCOUNT_TYPE_LABELS.KEWAJIBAN, values: totalKewajiban, style: "subtotal" },
    ...kewajibanRows,
    { label: ACCOUNT_TYPE_LABELS.EKUITAS, values: totalEkuitas, style: "subtotal" },
    ...ekuitasRecordedRows,
    labaBerjalanRow,
    { label: "TOTAL KEWAJIBAN + EKUITAS", values: totalKewajibanEkuitas, style: "total" },
  ];

  const isBalancedAtMonth = Math.abs(totalAset[upToMonth] - totalKewajibanEkuitas[upToMonth]) < 1;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Keuangan"
        description="Laba Rugi dan Neraca — setiap akun tampil satu per satu, dibandingkan per bulan Januari–Desember. HPP dibahas terperinci di Laporan HPP."
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
          <div
            className={`ml-auto rounded-full px-3 py-1.5 text-xs font-bold ${isBalancedAtMonth ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
          >
            {isBalancedAtMonth ? "✓ Neraca Seimbang" : "⚠ Neraca Tidak Seimbang"} (per akhir bulan berjalan)
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Laba Rugi — {year} (per bulan)</p>
        </div>
        <MonthlyReportTable rows={laraRugiRows} year={year} upToMonth={upToMonth} totalLabel={`Total ${year}`} />
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Neraca — {year} (saldo akhir tiap bulan)</p>
        </div>
        <MonthlyReportTable rows={neracaRows} year={year} upToMonth={upToMonth} totalLabel="Posisi Terakhir" totalMode="latest" />
      </Card>
    </div>
  );
}
