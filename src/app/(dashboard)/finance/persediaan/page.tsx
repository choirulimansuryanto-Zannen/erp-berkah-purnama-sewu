import { Fragment } from "react";
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
import { getCompanyMaterialSchedule } from "@/lib/company-material";
import { ExportExcelButton } from "@/components/ui/export-excel-button";

const MONTH_LABELS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const qtyFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

// Persediaan — the periodic-inventory categories behind Laporan HPP's
// Awal+Pembelian-Akhir formula, given their own dedicated "kartu
// persediaan" view (Jan-Dec Awal/Masuk/Pemakaian/Akhir per category) plus
// the stock-opname input/history that used to live embedded in the HPP
// page — moved here since inventory management is its own concern, not
// just a costing input.
export default async function PersediaanPage({ searchParams }: { searchParams: Promise<{ year?: string; cmYear?: string; cmMonth?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam, cmYear: cmYearParam, cmMonth: cmMonthParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;

  // Separate year/month for the SKU-level "Riwayat Persediaan Akhir" snapshot
  // below — a periodic stock-opname doesn't auto-roll-forward like a
  // depreciation schedule (each month needs its own opname), so default to
  // the latest month that actually has one recorded rather than "now",
  // which would otherwise show a confusing all-zero table by default.
  let cmYear: number;
  let cmMonth: number;
  if (cmYearParam && cmMonthParam) {
    cmYear = Number(cmYearParam);
    cmMonth = Number(cmMonthParam);
  } else {
    const latestCm = await prisma.companyMaterialClosingBalance.findFirst({ orderBy: [{ year: "desc" }, { month: "desc" }] });
    cmYear = latestCm?.year ?? now.getFullYear();
    cmMonth = latestCm?.month ?? now.getMonth() + 1;
  }

  const [report, closingRows, companyMaterialSchedule] = await Promise.all([
    getMonthlyHppReport(year),
    prisma.inventoryClosingBalance.findMany({
      where: { year },
      include: { recordedBy: { select: { name: true } } },
      orderBy: [{ month: "desc" }, { category: "asc" }],
    }),
    getCompanyMaterialSchedule(cmYear, cmMonth),
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
          <CardTitle>Riwayat Persediaan Akhir — Ringkasan per Kategori ({year})</CardTitle>
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

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label className="text-[11px]">Bulan</Label>
            <Select name="cmMonth" defaultValue={String(cmMonth)} className="mt-1">
              {MONTH_LABELS_ID.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Tahun</Label>
            <Select name="cmYear" defaultValue={String(cmYear)} className="mt-1">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          {/* Preserve the page's own year filter so switching the SKU
              snapshot period doesn't silently reset Kartu Persediaan above. */}
          <input type="hidden" name="year" value={year} />
          <Button type="submit" variant="secondary">
            Tampilkan
          </Button>
        </form>
      </Card>

      <Card className="p-0" id="riwayat-persediaan-sku-section">
        <CardHeader className="sticky top-16 z-30 h-14 bg-white">
          <CardTitle>
            Riwayat Persediaan Akhir — Rincian per Barang (SKU) — {MONTH_LABELS_ID[cmMonth - 1]} {cmYear}
          </CardTitle>
          <ExportExcelButton containerId="riwayat-persediaan-sku-section" filename={`Riwayat_Persediaan_${MONTH_LABELS_ID[cmMonth - 1]}_${cmYear}.xlsx`} />
        </CardHeader>

        <div className="overflow-x-auto" data-sheet-name="Riwayat Persediaan">
          <div className="max-h-[75vh] overflow-y-auto">
            <table className="w-full min-w-[1400px] border-collapse text-xs">
              <thead className="sticky top-0 z-20">
                <tr className="bg-brand-950 text-white">
                  <th rowSpan={2} className="sticky left-0 z-30 border-r border-brand-900 bg-brand-950 px-2 py-2 text-left">
                    Kode
                  </th>
                  <th rowSpan={2} className="sticky left-14 z-30 min-w-[220px] border-r border-brand-900 bg-brand-950 px-3 py-2 text-left">
                    Nama Barang
                  </th>
                  <th rowSpan={2} className="border-r border-brand-900 px-2 py-2 text-left">
                    Satuan
                  </th>
                  <th colSpan={4} className="border-r border-brand-900 bg-gold-600 px-3 py-2 text-center text-brand-950">
                    {MONTH_LABELS_ID[cmMonth - 1]}-{String(cmYear).slice(2)} Saldo Akhir
                  </th>
                  <th colSpan={2} className="border-r border-brand-900 bg-accent-200 px-3 py-2 text-center text-brand-950">
                    Faktur 01 {MONTH_LABELS_ID[companyMaterialSchedule.nextMonthIdx]} {companyMaterialSchedule.nextMonthYear} Outlet
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center">
                    Total
                  </th>
                </tr>
                <tr className="bg-gold-500 text-brand-950">
                  <th className="border-r border-gold-600 px-2 py-1.5 text-right font-semibold">Qty Opname</th>
                  <th className="border-r border-gold-600 px-2 py-1.5 text-right font-semibold">Cost/satuan</th>
                  <th className="border-r border-gold-600 px-2 py-1.5 text-right font-semibold">Nilai Akhir Persediaan</th>
                  <th className="border-r border-brand-900 bg-gold-600 px-2 py-1.5 text-right font-semibold">Adjustment Nilai</th>
                  <th className="border-r border-accent-300 bg-accent-200 px-2 py-1.5 text-right font-semibold text-brand-950">Qty</th>
                  <th className="border-r border-brand-900 bg-accent-200 px-2 py-1.5 text-right font-semibold text-brand-950">Nominal (Rp)</th>
                  <th className="border-r border-slate-300 bg-slate-100 px-2 py-1.5 text-right font-semibold">Qty</th>
                  <th className="bg-slate-100 px-2 py-1.5 text-right font-semibold">Nominal (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {companyMaterialSchedule.groups.map((g) => (
                  <Fragment key={g.category}>
                    <tr className="bg-slate-100">
                      <td colSpan={11} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-900">
                        {g.label}
                      </td>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-gold-50/40">
                        <td className="sticky left-0 z-10 bg-inherit px-2 py-1.5 text-slate-500">{r.code}</td>
                        <td className="sticky left-14 z-10 bg-inherit px-3 py-1.5 font-medium text-slate-900">{r.name}</td>
                        <td className="px-2 py-1.5 text-slate-500">{r.unit}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.qtyOpname > 0 ? qtyFormat.format(r.qtyOpname) : "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.costPerUnit > 0 ? currency.format(r.costPerUnit) : "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.nilaiAkhir > 0 ? currency.format(r.nilaiAkhir) : "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.adjustmentNilai !== 0 ? currency.format(r.adjustmentNilai) : "-"}</td>
                        <td className="bg-accent-50 px-2 py-1.5 text-right tabular-nums">{r.fakturOutletQty > 0 ? qtyFormat.format(r.fakturOutletQty) : "-"}</td>
                        <td className="bg-accent-50 px-2 py-1.5 text-right tabular-nums">{r.fakturOutletNominal > 0 ? currency.format(r.fakturOutletNominal) : "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.totalQty !== 0 ? qtyFormat.format(r.totalQty) : "-"}</td>
                        <td className="bg-gold-50/40 px-2 py-1.5 text-right font-semibold tabular-nums text-brand-900">
                          {r.totalNominal !== 0 ? currency.format(r.totalNominal) : "-"}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gold-50 font-bold text-brand-900">
                      <td colSpan={5} className="sticky left-0 z-10 bg-gold-50 px-3 py-1.5">
                        TOTAL {g.label}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{currency.format(g.totalNilaiAkhir)}</td>
                      <td />
                      <td className="bg-accent-100 px-2 py-1.5 text-right tabular-nums" colSpan={2}>
                        {currency.format(g.totalFakturNominal)}
                      </td>
                      <td />
                      <td className="px-2 py-1.5 text-right tabular-nums">{currency.format(g.totalNominal)}</td>
                    </tr>
                  </Fragment>
                ))}
                {companyMaterialSchedule.groups.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-slate-400">
                      Belum ada data stock-opname untuk periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
              {companyMaterialSchedule.groups.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-brand-900">
                    <td colSpan={5} className="px-3 py-2">
                      TOTAL OPERASIONAL
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{currency.format(companyMaterialSchedule.operasional.totalNilaiAkhir)}</td>
                    <td />
                    <td colSpan={2} className="px-2 py-2 text-right tabular-nums">
                      {currency.format(companyMaterialSchedule.operasional.totalFakturNominal)}
                    </td>
                    <td />
                    <td className="px-2 py-2 text-right tabular-nums">{currency.format(companyMaterialSchedule.operasional.totalNominal)}</td>
                  </tr>
                  <tr className="bg-slate-50 font-semibold text-brand-900">
                    <td colSpan={5} className="px-3 py-2">
                      TOTAL PRODUKSI
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{currency.format(companyMaterialSchedule.produksi.totalNilaiAkhir)}</td>
                    <td />
                    <td colSpan={2} className="px-2 py-2 text-right tabular-nums">
                      {currency.format(companyMaterialSchedule.produksi.totalFakturNominal)}
                    </td>
                    <td />
                    <td className="px-2 py-2 text-right tabular-nums">{currency.format(companyMaterialSchedule.produksi.totalNominal)}</td>
                  </tr>
                  <tr className="bg-brand-900 font-bold text-white">
                    <td colSpan={5} className="px-3 py-2">
                      TOTAL
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{currency.format(companyMaterialSchedule.grandTotal.totalNilaiAkhir)}</td>
                    <td />
                    <td colSpan={2} className="px-2 py-2 text-right tabular-nums">
                      {currency.format(companyMaterialSchedule.grandTotal.totalFakturNominal)}
                    </td>
                    <td />
                    <td className="px-2 py-2 text-right tabular-nums">{currency.format(companyMaterialSchedule.grandTotal.totalNominal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Card>

      <Card className="p-0">
        <div className="sticky top-16 z-30 flex h-11 items-center rounded-t-xl bg-brand-950 px-5">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Kartu Persediaan — {year} (per bulan)</p>
        </div>
        <MonthlyReportTable rows={rows} year={year} upToMonth={upToMonth} totalLabel="Posisi Terakhir" />
      </Card>
    </div>
  );
}
