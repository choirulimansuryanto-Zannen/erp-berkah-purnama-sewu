import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMonthlyAccountMatrix, ACCOUNT_TYPE_LABELS } from "@/lib/accounting";
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

export default async function FinanceReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;

  const matrix = await getMonthlyAccountMatrix(year);

  function byType(type: AccountType) {
    return matrix.filter((a) => a.type === type && a.monthly.some((v) => v !== 0));
  }
  function accountRows(type: AccountType, negative = false): MonthlyReportRow[] {
    return byType(type).map((a) => ({ code: a.code, label: a.name, values: a.monthly, indent: true, negative }));
  }
  function neracaAccountRows(type: AccountType): MonthlyReportRow[] {
    return matrix
      .filter((a) => a.type === type && a.cumulative.some((v) => v !== 0))
      .map((a) => ({ code: a.code, label: a.name, values: a.cumulative, indent: true }));
  }

  // ── Laba Rugi ──────────────────────────────────────────────────────
  const pendapatanRows = accountRows("PENDAPATAN");
  const hppRows = accountRows("HARGA_POKOK_PENJUALAN", true);
  const bebanLangsungRows = accountRows("BEBAN_LANGSUNG", true);
  const bebanOperasionalRows = accountRows("BEBAN_OPERASIONAL", true);
  const bebanNonOpRows = accountRows("BEBAN_NON_OPERASIONAL", true);
  const pendapatanNonOpRows = accountRows("PENDAPATAN_NON_OPERASIONAL");

  const totalPendapatan = sumRows(pendapatanRows);
  const totalHpp = sumRows(hppRows);
  const labaKotor = addSeries(totalPendapatan, negate(totalHpp));
  const totalBebanLangsung = sumRows(bebanLangsungRows);
  const totalBebanOperasional = sumRows(bebanOperasionalRows);
  const labaUsaha = addSeries(labaKotor, negate(totalBebanLangsung), negate(totalBebanOperasional));
  const totalBebanNonOp = sumRows(bebanNonOpRows);
  const totalPendapatanNonOp = sumRows(pendapatanNonOpRows);
  const labaBersih = addSeries(labaUsaha, totalPendapatanNonOp, negate(totalBebanNonOp));

  const labaRugiRows: MonthlyReportRow[] = [
    { label: ACCOUNT_TYPE_LABELS.PENDAPATAN, values: totalPendapatan, style: "subtotal" },
    ...pendapatanRows,
    { label: `(-) ${ACCOUNT_TYPE_LABELS.HARGA_POKOK_PENJUALAN}`, values: totalHpp, style: "subtotal", negative: true },
    ...hppRows,
    { label: "Laba Kotor", values: labaKotor, style: "total" },
    { label: `(-) ${ACCOUNT_TYPE_LABELS.BEBAN_LANGSUNG}`, values: totalBebanLangsung, style: "subtotal", negative: true },
    ...bebanLangsungRows,
    { label: `(-) ${ACCOUNT_TYPE_LABELS.BEBAN_OPERASIONAL}`, values: totalBebanOperasional, style: "subtotal", negative: true },
    ...bebanOperasionalRows,
    { label: "Laba Usaha", values: labaUsaha, style: "total" },
    { label: `(+) ${ACCOUNT_TYPE_LABELS.PENDAPATAN_NON_OPERASIONAL}`, values: totalPendapatanNonOp, style: "subtotal" },
    ...pendapatanNonOpRows,
    { label: `(-) ${ACCOUNT_TYPE_LABELS.BEBAN_NON_OPERASIONAL}`, values: totalBebanNonOp, style: "subtotal", negative: true },
    ...bebanNonOpRows,
    { label: "LABA (RUGI) BERSIH", values: labaBersih, style: "total" },
  ];

  // ── Neraca (cumulative — end-of-month balances) ──────────────────────
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
        description="Laba Rugi dan Neraca — setiap akun tampil satu per satu, dibandingkan per bulan Januari–Desember."
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
        <MonthlyReportTable rows={labaRugiRows} year={year} upToMonth={upToMonth} totalLabel={`Total ${year}`} />
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
