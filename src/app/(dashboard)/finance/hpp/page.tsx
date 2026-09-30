import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Boxes } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMonthlyHppReport } from "@/lib/accounting";
import { MonthlyReportTable, type MonthlyReportRow } from "@/components/finance/monthly-report-table";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const ZERO_12 = () => Array.from({ length: 12 }, () => 0);
function addSeries(...series: number[][]): number[] {
  return ZERO_12().map((_, i) => series.reduce((s, arr) => s + arr[i], 0));
}

// Laporan HPP — periodic-inventory cost-of-goods build-up: Persediaan Awal
// + Pembelian - Persediaan Akhir per kategori bahan, plus Beban Overhead
// Pabrik and Proyek Dalam Penyelesaian, ending in HARGA POKOK PENJUALAN —
// the same total /finance/reports pulls into its "Dikurangi HPP" line.
export default async function HppReportPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;

  const report = await getMonthlyHppReport(year);

  const rows: MonthlyReportRow[] = [];
  for (const cat of report.categories) {
    rows.push({ label: `Persediaan Awal ${cat.label}`, values: cat.awal, indent: true, totalMode: "latest" });
    for (const a of cat.purchaseAccounts) {
      rows.push({ code: a.code, label: a.name, values: a.monthly, indent: true });
    }
    rows.push({ label: "Barang sedia untuk produksi", values: addSeries(cat.awal, cat.pembelian), style: "subtotal" });
    rows.push({ label: `Persediaan Akhir ${cat.label}`, values: cat.akhir, indent: true, negative: true, totalMode: "latest" });
    rows.push({ label: `TOTAL PEMAKAIAN ${cat.label}`, values: cat.pemakaian, style: "total" });
  }

  rows.push({ label: "JUMLAH PEMAKAIAN BAHAN (4 KATEGORI)", values: report.totalPemakaianBahan, style: "subtotal" });

  for (const a of report.overheadAccounts) {
    rows.push({ code: a.code, label: a.name, values: a.monthly, indent: true });
  }
  rows.push({ label: "TOTAL BEBAN OVERHEAD PABRIK", values: report.totalOverhead, style: "total" });

  rows.push({ label: "JUMLAH BEBAN PRODUKSI", values: report.jumlahBebanProduksi, style: "subtotal" });

  const proyek = report.proyek;
  rows.push({ label: `Persediaan Awal ${proyek.label}`, values: proyek.awal, indent: true, totalMode: "latest" });
  for (const a of proyek.purchaseAccounts) {
    rows.push({ code: a.code, label: a.name, values: a.monthly, indent: true });
  }
  rows.push({ label: `Persediaan Akhir ${proyek.label}`, values: proyek.akhir, indent: true, negative: true, totalMode: "latest" });
  rows.push({ label: `TOTAL ${proyek.label}`, values: proyek.pemakaian, style: "total" });

  rows.push({ label: "HARGA POKOK PENJUALAN (Basis Akrual — Awal+Pembelian-Akhir)", values: report.totalHpp, style: "total" });
  // The formal Laba Rugi/Neraca use the cash-basis figure instead (this
  // ERP is deliberately cash-basis throughout — see the cashBasisHpp doc
  // comment in accounting.ts). Shown here too so the gap — unconsumed
  // inventory sitting in cash already spent this period — is visible, not
  // hidden.
  rows.push({ label: "HARGA POKOK PENJUALAN (Basis Kas — dipakai di Laba Rugi & Neraca)", values: report.cashBasisHpp, style: "subtotal" });

  const missingMonths = new Set<string>();
  for (const cat of [...report.categories, report.proyek]) {
    for (const m of cat.monthsMissingClosing) {
      if (m <= upToMonth + 1) missingMonths.add(`${cat.label} (${MONTH_NAMES[m - 1]})`);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan HPP"
        description="Harga Pokok Penjualan — Persediaan Awal + Pembelian - Persediaan Akhir per kategori bahan, ditambah Beban Overhead Pabrik dan Proyek Dalam Penyelesaian."
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

      {missingMonths.size > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Persediaan Akhir belum diisi untuk {missingMonths.size} kombinasi bulan/kategori:</p>
            <p className="mt-1 text-xs">
              {[...missingMonths].join(", ")}. Nilai dianggap 0 sampai diisi lewat form di bawah — Pemakaian bulan tersebut
              belum tentu akurat.
            </p>
          </div>
        </div>
      )}

      <Link
        href="/finance/persediaan"
        className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-4 text-sm font-medium text-brand-900 shadow-[var(--shadow-card)] transition-colors hover:bg-slate-50"
      >
        <Boxes className="h-5 w-5 text-accent-600" />
        Kelola Persediaan Akhir (stock opname) &amp; lihat kartu persediaan per kategori →
      </Link>

      <Card className="p-0">
        <div className="sticky top-16 z-30 flex h-11 items-center rounded-t-xl bg-brand-950 px-5">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Laporan HPP — {year} (per bulan)</p>
        </div>
        <MonthlyReportTable rows={rows} year={year} upToMonth={upToMonth} totalLabel={`Total ${year}`} />
      </Card>
    </div>
  );
}
