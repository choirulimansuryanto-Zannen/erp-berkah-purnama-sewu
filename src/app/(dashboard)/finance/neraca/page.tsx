import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMonthlyAccountMatrix, getMonthlyHppReport, computeLabaBersihSeries, accountSubtree, typeNaturalValue, type MonthlyAccountRow } from "@/lib/accounting";
import { MonthlyReportTable, type MonthlyReportRow } from "@/components/finance/monthly-report-table";

const ZERO_12 = () => Array.from({ length: 12 }, () => 0);
function addSeries(...series: number[][]): number[] {
  return ZERO_12().map((_, i) => series.reduce((s, arr) => s + arr[i], 0));
}
function naturalCumulative(a: MonthlyAccountRow): number[] {
  return a.cumulative.map((v) => typeNaturalValue(v, a.type, a.normalBalance));
}

// Laba Rugi moved to its own page (/finance/reports) — this page is Neraca
// only, matching PT. Berkah Purnama Sewu's own chart of accounts exactly
// (10000-34000): ASSET (lancar) -> ASSET TETAP (gross, then Akumulasi
// Penyusutan as its own subtotal) -> ASSET TAK BERWUJUD -> TOTAL AKTIVA;
// KEWAJIBAN -> EKUITAS -> TOTAL PASIVA.
export default async function NeracaPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;

  const [matrix, hppReport] = await Promise.all([getMonthlyAccountMatrix(year), getMonthlyHppReport(year)]);

  function groupRows(parentCode: string, filter?: (a: MonthlyAccountRow) => boolean): MonthlyReportRow[] {
    return accountSubtree(matrix, parentCode)
      .filter((a) => a.code !== parentCode && a.cumulative.some((v) => v !== 0) && (!filter || filter(a)))
      .map((a) => ({ code: a.code, label: a.name, values: naturalCumulative(a), indent: true }));
  }
  function groupTotal(parentCode: string, filter?: (a: MonthlyAccountRow) => boolean): number[] {
    const accounts = accountSubtree(matrix, parentCode).filter((a) => a.code !== parentCode && (!filter || filter(a)));
    return addSeries(...accounts.map(naturalCumulative));
  }

  const rows: MonthlyReportRow[] = [];

  // ── ASSET (lancar) — 10000 ───────────────────────────────────────────
  const totalAsset = groupTotal("10000");
  rows.push({ label: "TOTAL ASSET", values: totalAsset, style: "subtotal" });
  rows.push(...groupRows("10000"));

  // ── ASSET TETAP — 18000, split gross vs Akumulasi Penyusutan ─────────
  const isGrossFixedAsset = (a: MonthlyAccountRow) => a.normalBalance === "DEBIT";
  const isAccumulatedDepreciation = (a: MonthlyAccountRow) => a.normalBalance === "KREDIT";
  const totalAsetTetap = groupTotal("18000", isGrossFixedAsset);
  rows.push({ label: "TOTAL ASSET TETAP", values: totalAsetTetap, style: "subtotal" });
  rows.push(...groupRows("18000", isGrossFixedAsset));
  const totalAkumulasiPenyusutan = groupTotal("18000", isAccumulatedDepreciation);
  rows.push({ label: "TOTAL AKUMULASI PENYUSUTAN", values: totalAkumulasiPenyusutan, style: "subtotal" });
  rows.push(...groupRows("18000", isAccumulatedDepreciation));

  // ── ASSET TAK BERWUJUD — 19000 ────────────────────────────────────────
  const totalAsetTakBerwujud = groupTotal("19000");
  rows.push({ label: "TOTAL ASSET TAK BERWUJUD", values: totalAsetTakBerwujud, style: "subtotal" });
  rows.push(...groupRows("19000"));

  // totalAkumulasiPenyusutan is already negative (typeNaturalValue flips a
  // credit-normal contra account inside the debit-normal ASET type) — a
  // plain addSeries nets it against the gross total correctly.
  const totalAktiva = addSeries(totalAsset, totalAsetTetap, totalAkumulasiPenyusutan, totalAsetTakBerwujud);
  rows.push({ label: "TOTAL AKTIVA", values: totalAktiva, style: "total" });

  // ── KEWAJIBAN — 21000 ──────────────────────────────────────────────────
  const totalKewajiban = groupTotal("21000");
  rows.push({ label: "TOTAL KEWAJIBAN", values: totalKewajiban, style: "subtotal" });
  rows.push(...groupRows("21000"));

  // ── EKUITAS — 30000. "33000 Laba (Rugi) Tahun Berjalan" is never posted
  // to directly (see the ChartOfAccount seed comment) — its figure here is
  // computeLabaBersihSeries running-summed, shown under that same code so
  // the report still matches the company's real chart of accounts. ──────
  const labaBersih = computeLabaBersihSeries(matrix, hppReport.cashBasisHpp);
  let runningLaba = 0;
  const labaBerjalanCumulative = labaBersih.map((v) => {
    runningLaba += v;
    return runningLaba;
  });
  const totalEkuitasRecorded = groupTotal("30000", (a) => a.code !== "33000");
  rows.push({ label: "TOTAL EKUITAS", values: addSeries(totalEkuitasRecorded, labaBerjalanCumulative), style: "subtotal" });
  rows.push(...groupRows("30000", (a) => a.code !== "33000"));
  rows.push({ code: "33000", label: "Laba (Rugi) Tahun Berjalan", values: labaBerjalanCumulative, indent: true });

  const totalEkuitas = addSeries(totalEkuitasRecorded, labaBerjalanCumulative);
  const totalPasiva = addSeries(totalKewajiban, totalEkuitas);
  rows.push({ label: "TOTAL PASIVA", values: totalPasiva, style: "total" });

  const isBalancedAtMonth = Math.abs(totalAktiva[upToMonth] - totalPasiva[upToMonth]) < 1;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Neraca"
        description="Posisi keuangan — Aktiva dan Pasiva, setiap akun tampil satu per satu, saldo akhir tiap bulan Januari–Desember."
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

      <Card className="p-0">
        <div className="sticky top-16 z-30 flex h-11 items-center rounded-t-xl bg-brand-950 px-5">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Neraca — {year} (saldo akhir tiap bulan)</p>
        </div>
        <MonthlyReportTable rows={rows} year={year} upToMonth={upToMonth} totalLabel="Posisi Terakhir" totalMode="latest" />
      </Card>
    </div>
  );
}
