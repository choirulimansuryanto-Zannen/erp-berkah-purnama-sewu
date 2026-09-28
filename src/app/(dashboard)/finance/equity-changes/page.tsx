import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMonthlyAccountMatrix, computeLabaBersihSeries, typeNaturalValue } from "@/lib/accounting";
import { MonthlyReportTable, type MonthlyReportRow } from "@/components/finance/monthly-report-table";

const ZERO_12 = () => Array.from({ length: 12 }, () => 0);
function addSeries(...series: number[][]): number[] {
  return ZERO_12().map((_, i) => series.reduce((s, arr) => s + arr[i], 0));
}

// Modal Awal -> (+) setoran/perubahan tiap akun Ekuitas -> (+) Laba Bersih
// bulan berjalan -> = Modal Akhir, dibaca langsung dari jurnal (bukan
// diketik manual) — baris "Ekuitas Akhir" di sini harus selalu sama
// persis dengan baris Ekuitas di Neraca bulan yang sama.
export default async function EquityChangesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;

  const matrix = await getMonthlyAccountMatrix(year);
  const ekuitasAccounts = matrix.filter((a) => a.type === "EKUITAS");
  // typeNaturalValue: a contra-equity account (e.g. Prive/drawing, debit-
  // normal inside credit-normal EKUITAS) must subtract from equity, not add.
  const naturalMonthly = (a: (typeof ekuitasAccounts)[number]) => a.monthly.map((v) => typeNaturalValue(v, a.type, a.normalBalance));
  const openingEkuitas = ekuitasAccounts.reduce((s, a) => s + typeNaturalValue(a.opening, a.type, a.normalBalance), 0);
  const labaBersih = computeLabaBersihSeries(matrix);

  const rows: MonthlyReportRow[] = [];
  for (const a of ekuitasAccounts.filter((a) => a.monthly.some((v) => v !== 0))) {
    rows.push({ code: a.code, label: `Perubahan — ${a.name}`, values: naturalMonthly(a), indent: true });
  }
  rows.push({ label: "Laba (Rugi) Bersih Bulan Berjalan", values: labaBersih });

  const totalChange = addSeries(
    ...ekuitasAccounts.map(naturalMonthly),
    labaBersih,
  );
  let running = openingEkuitas;
  const endingEquity = totalChange.map((_, i) => {
    running += totalChange[i];
    return running;
  });

  rows.push({ label: "TOTAL PERUBAHAN EKUITAS", values: totalChange, style: "subtotal" });
  rows.push({ label: "EKUITAS AKHIR (kumulatif)", values: endingEquity, style: "total", totalMode: "latest" });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Perubahan Ekuitas"
        description="Modal awal, ditambah setoran/laba bersih tiap bulan, sampai posisi ekuitas akhir — harus selalu cocok dengan baris Ekuitas di Neraca."
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
          <p className="ml-auto text-xs text-slate-500">
            Ekuitas Awal {year}: <span className="font-bold text-brand-900">{currency.format(openingEkuitas)}</span>
          </p>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Perubahan Ekuitas — {year} (per bulan)</p>
        </div>
        <MonthlyReportTable rows={rows} year={year} upToMonth={upToMonth} totalLabel={`Total ${year}`} />
      </Card>
    </div>
  );
}
