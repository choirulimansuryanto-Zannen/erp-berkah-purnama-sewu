import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMonthlyHppReport } from "@/lib/accounting";
import { prisma } from "@/lib/prisma";
import { MonthlyReportTable, type MonthlyReportRow } from "@/components/finance/monthly-report-table";
import { InventoryClosingForm } from "@/components/finance/inventory-closing-form";
import { InventoryClosingList } from "@/components/finance/inventory-closing-list";

// Persediaan — the periodic-inventory categories behind Laporan HPP's
// Awal+Pembelian-Akhir formula, given their own dedicated "kartu
// persediaan" view (Jan-Dec Awal/Masuk/Pemakaian/Akhir per category) plus
// the stock-opname input/history that used to live embedded in the HPP
// page — moved here since inventory management is its own concern, not
// just a costing input.
export default async function PersediaanPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;

  const [report, closingRows] = await Promise.all([
    getMonthlyHppReport(year),
    prisma.inventoryClosingBalance.findMany({
      where: { year },
      include: { recordedBy: { select: { name: true } } },
      orderBy: [{ month: "desc" }, { category: "asc" }],
    }),
  ]);

  const rows: MonthlyReportRow[] = [];
  for (const cat of [...report.categories, report.proyek]) {
    rows.push({ label: cat.label, values: Array(12).fill(0), style: "subtotal" });
    rows.push({ label: "Persediaan Awal", values: cat.awal, indent: true, totalMode: "latest" });
    rows.push({ label: "Masuk (Pembelian/Produksi)", values: cat.pembelian, indent: true });
    rows.push({ label: "Pemakaian (Terpakai/Terjual)", values: cat.pemakaian, indent: true, negative: true });
    rows.push({ label: "Persediaan Akhir", values: cat.akhir, indent: true, totalMode: "latest" });
  }

  const totalPersediaanAkhir = [...report.categories, report.proyek].reduce(
    (acc, cat) => acc.map((v, i) => v + cat.akhir[i]),
    Array(12).fill(0) as number[],
  );
  rows.push({ label: "TOTAL PERSEDIAAN AKHIR (SEMUA KATEGORI)", values: totalPersediaanAkhir, style: "total", totalMode: "latest" });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Persediaan"
        description="Kartu persediaan per kategori — Persediaan Awal, Masuk, Pemakaian, Persediaan Akhir tiap bulan. Input Persediaan Akhir lewat form di bawah tiap tutup bulan."
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

      <InventoryClosingForm />

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Persediaan Akhir {year}</CardTitle>
        </CardHeader>
        <InventoryClosingList
          rows={closingRows.map((r) => ({
            id: r.id,
            year: r.year,
            month: r.month,
            category: r.category,
            amount: Number(r.amount),
            note: r.note,
            recordedBy: r.recordedBy,
          }))}
        />
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Kartu Persediaan — {year} (per bulan)</p>
        </div>
        <MonthlyReportTable rows={rows} year={year} upToMonth={upToMonth} totalLabel="Posisi Terakhir" />
      </Card>
    </div>
  );
}
