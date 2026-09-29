import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OutletPurchaseForm, OutletPurchaseDeleteButton } from "@/components/finance/outlet-purchase-form";
import { OutletAdjustmentForm, OutletAdjustmentDeleteButton } from "@/components/finance/outlet-adjustment-form";
import { OutletMaterialAkhirInput } from "@/components/finance/outlet-material-akhir-input";
import { OutletLedgerEntryForm, OutletLedgerEntryDeleteButton } from "@/components/finance/outlet-ledger-entry-form";
import { OutletPayrollInput } from "@/components/finance/outlet-payroll-input";
import { OutletReportSelector } from "@/components/finance/outlet-report-selector";
import {
  getOmsetSheet,
  getJpdSheet,
  getPurchaseSheet,
  getAdjustmentSheet,
  getReportSheet,
  getAkunLedgerSheet,
  getAbsenSheet,
  getInsentiveSheet,
  getInventorySheet,
  HARI_NAMES,
} from "@/lib/outlet-report";
import { Wallet, ShoppingBag, AlertTriangle, Sparkles, FileBarChart } from "lucide-react";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const number0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const number2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const OUTLET_CODE_RE = /[aiueoAIUEO]/g;
function outletShortCode(name: string): string {
  const consonantsOnly = name.replace(OUTLET_CODE_RE, "").replace(/[^A-Za-z]/g, "");
  return (consonantsOnly || name.replace(/[^A-Za-z]/g, "")).slice(0, 4).toUpperCase();
}

const MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  BAHAN_UTAMA: "Bahan Utama",
  BAHAN_BAKU_TAMBAHAN: "Bahan Baku Tambahan",
  PACKAGING: "Packaging",
  BAHAN_ALAT_PENDUKUNG: "Bahan & Alat Pendukung",
};
const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  RUSAK: "Barang Rusak",
  REJECT: "Barang Reject",
  SELISIH: "Barang Selisih",
  KELUAR: "Barang Keluar (Mutasi)",
};

// Laporan Outlet — one outlet, one month, all 8 sheets exactly as specified
// from the real spreadsheets: Omset (per-product + daging ketul usage),
// Purchase (barang masuk pramuniaga + local buys), Adjustment (input form),
// Akun (Penjualan per channel / Pembelian / Biaya Overhead), Absen+Insentive
// (bracket-based per-employee), Inventory (Data Stock Available), and
// Report (investor summary). See src/lib/outlet-report.ts for the engine.
export default async function OutletDetailReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ outletId: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const { outletId } = await params;
  const now = new Date();
  const { year: yearParam, month: monthParam } = await searchParams;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const [outlet, allOutlets, materials, ledgerAccounts] = await Promise.all([
    prisma.outlet.findUnique({ where: { id: outletId }, include: { region: true } }),
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.outletMaterial.findMany({ where: { status: "ACTIVE" }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    prisma.outletLedgerAccount.findMany({ where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!outlet) notFound();

  let year: number;
  let month: number;
  if (yearParam || monthParam) {
    year = yearParam ? Number(yearParam) : now.getFullYear();
    month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  } else {
    // No period picked — default to the current month, but if this outlet
    // has no verified report for it yet (a demo/staging environment's
    // fixed sample data will eventually fall behind "today" no matter
    // what fixed offset is chosen), fall back to the month of this
    // outlet's own most recent verified report instead of opening on 8
    // empty sheets.
    const currentMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const hasCurrentMonthData = await prisma.dailyReport.count({
      where: { outletId, status: "APPROVED", date: { gte: currentMonthStart, lte: now } },
    });
    if (hasCurrentMonthData > 0) {
      year = now.getFullYear();
      month = now.getMonth() + 1;
    } else {
      const latestReport = await prisma.dailyReport.findFirst({ where: { outletId, status: "APPROVED" }, orderBy: { date: "desc" } });
      if (latestReport) {
        year = latestReport.date.getUTCFullYear();
        month = latestReport.date.getUTCMonth() + 1;
      } else {
        year = now.getFullYear();
        month = now.getMonth() + 1;
      }
    }
  }

  const omset = await getOmsetSheet(outletId, year, month);
  const [jpd, purchase, adjustment, inventory, ledger] = await Promise.all([
    getJpdSheet(outletId, year, month, omset),
    getPurchaseSheet(outletId, year, month),
    getAdjustmentSheet(outletId, year, month),
    getInventorySheet(outletId, year, month),
    getAkunLedgerSheet(outletId, year, month),
  ]);
  const report = await getReportSheet(outletId, year, month, inventory);
  const absen = await getAbsenSheet(outletId, year, month, omset);
  const insentive = await getInsentiveSheet(outletId, year, month, jpd, report, absen);

  const materialsForForms = materials.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }));
  const materialsByCategory = new Map<string, typeof inventory.rows>();
  for (const r of inventory.rows) materialsByCategory.set(r.category, [...(materialsByCategory.get(r.category) ?? []), r]);
  const ledgerAccountOptions = ledgerAccounts.map((a) => ({ id: a.id, number: a.number, label: a.label, defaultSide: a.defaultSide }));
  const outletCode = outletShortCode(outlet.name);

  // ── h. Report Sheet — the investor-facing summary, taken straight from
  // the Jurnal Sheet ledger (report.labaBersih already includes whatever
  // Insentive figure was actually posted to account #22 that month) —
  // the bracket-calculated totalInsentifSemua below is a separate
  // reference/KPI figure, not subtracted again here.
  const totalInsentifSemua = absen.totalInsentiveValue + insentive.royalti + insentive.insentiveOfficer + insentive.insentiveHead;
  const reportLabaBersih = report.labaBersih;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Laporan Outlet — ${outlet.name}`}
        description={`${outlet.region.name} — Omset, Purchase, Adjustment, Akun, Absen, Insentive, Inventory, dan Report Sheet untuk ${MONTH_NAMES[month - 1]} ${year}.`}
        actions={
          <Link href="/finance/outlet" className="text-xs font-bold text-accent-700 hover:text-accent-800">
            ← Kembali ke Rekap Semua Outlet
          </Link>
        }
      />

      <Card className="p-0">
        <OutletReportSelector outlets={allOutlets} outletId={outletId} year={year} month={month} years={years} />
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Omset" value={currency.format(omset.totalOmset)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Total Purchase" value={currency.format(purchase.total)} tone="accent" icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Total Adjustment" value={currency.format(adjustment.total)} tone={adjustment.total > 0 ? "warning" : "success"} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Total Insentif" value={currency.format(totalInsentifSemua)} tone="info" icon={<Sparkles className="h-4 w-4" />} />
      </div>

      {/* a. Omset Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>a. Omset Sheet — Rekap Penjualan per Produk</CardTitle>
          <p className="text-xs text-slate-400">
            Produk dengan latar <span className="rounded bg-yellow-200 px-1 font-semibold text-yellow-900">kuning</span> menggunakan daging ketul. Paket
            (MBG/Kopdes/Trio/dll) diterjemahkan ke produk &amp; topping penyusunnya — paket itu sendiri tidak muncul sebagai kolom.
          </p>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <tr>
                <Th className="sticky left-0 z-10 bg-slate-50">Tanggal</Th>
                <Th className="text-right">Total Omset</Th>
                {omset.items.map((it) => (
                  <Th key={it.key} className={`text-right ${it.usesDagingKetul ? "bg-yellow-100" : ""}`}>
                    {it.name}
                    {it.kind === "topping" && <span className="ml-1 text-[10px] font-normal text-slate-400">(Topping)</span>}
                  </Th>
                ))}
              </tr>
            </Thead>
            <tbody>
              {omset.days.map((d, i) => (
                <Tr key={i}>
                  <Td className="sticky left-0 z-10 bg-white font-medium text-slate-900">{d.date.getUTCDate()}</Td>
                  <Td className="text-right font-semibold tabular-nums">{currency.format(d.totalOmset)}</Td>
                  {omset.items.map((it) => (
                    <Td key={it.key} className={`text-right tabular-nums ${it.usesDagingKetul ? "bg-yellow-50" : ""}`}>
                      {d.qtyByKey[it.key] ?? 0}
                    </Td>
                  ))}
                </Tr>
              ))}
              {omset.days.every((d) => d.qtyAllProducts === 0) && (
                <EmptyRow colSpan={omset.items.length + 2}>Belum ada penjualan tercatat bulan ini.</EmptyRow>
              )}
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td className="sticky left-0 z-10 bg-gold-50">TOTAL</Td>
                <Td className="text-right tabular-nums">{currency.format(omset.totalOmset)}</Td>
                {omset.items.map((it) => (
                  <Td key={it.key} className="text-right tabular-nums">
                    {omset.days.reduce((s, d) => s + (d.qtyByKey[it.key] ?? 0), 0)}
                  </Td>
                ))}
              </Tr>
            </tbody>
          </Table>
        </div>
      </Card>

      {/* JPD Sheet — yield KPI (Jumlah Produk per Daging), daily rollup */}
      <Card>
        <CardHeader>
          <CardTitle>JPD Sheet — Jumlah Produk per Daging</CardTitle>
          <p className="text-xs text-slate-400">
            Rata-rata Penggunaan Daging/Ketul (Pcs/4Kg) = produk daging ketul terjual ÷ pemakaian daging (dari data Freezer Material Daging @4kg + @2kg) — KPI
            yield yang sama dengan kartu JPD di menu Inventory.
          </p>
        </CardHeader>
        {!jpd.hasFreezerData && (
          <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Material freezer &quot;Daging @4kg&quot; / &quot;daging @2kg&quot; belum ditemukan — kolom pemakaian daging tidak dapat dihitung.
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <tr>
                <Th rowSpan={2}>Hari</Th>
                <Th rowSpan={2}>Tanggal</Th>
                <Th rowSpan={2} className="text-right">
                  Total Omset (Rp.)
                </Th>
                <Th colSpan={2} className="text-center">
                  Qty Omset /hari
                </Th>
                <Th colSpan={2} className="text-center">
                  Kumulatif
                </Th>
                <Th colSpan={2} className="text-center">
                  Rata-rata (AVG)
                </Th>
              </tr>
              <tr>
                <Th className="text-right">Semua Produk</Th>
                <Th className="text-right">Produk dgn daging Ketul</Th>
                <Th className="text-right">Produk dgn daging Ketul</Th>
                <Th className="text-right">Penggunaan Daging (Kg)</Th>
                <Th className="text-right">Penggunaan Daging/Ketul (Pcs/4Kg)</Th>
                <Th className="text-right">Sales /hari (Pcs)</Th>
              </tr>
            </Thead>
            <tbody>
              {jpd.days.map((d, i) => (
                <Tr key={i}>
                  <Td>{d.dayName}</Td>
                  <Td>{d.date.getUTCDate()}</Td>
                  <Td className="text-right font-semibold tabular-nums text-rose-700">{d.totalOmset > 0 ? currency.format(d.totalOmset) : "-"}</Td>
                  <Td className="text-right tabular-nums">{d.qtyAllProducts}</Td>
                  <Td className="text-right tabular-nums">{d.qtyDagingKetulProducts}</Td>
                  <Td className="text-right tabular-nums">{d.cumulativeDagingKetulProducts}</Td>
                  <Td className="text-right tabular-nums">{number0.format(d.cumulativeDagingKg)}</Td>
                  <Td className="text-right tabular-nums">{number0.format(d.avgYieldPcsPer4Kg)}</Td>
                  <Td className="text-right tabular-nums">{number0.format(d.avgSalesPerDay)}</Td>
                </Tr>
              ))}
              {jpd.days.length === 0 && <EmptyRow colSpan={9}>Belum ada data.</EmptyRow>}
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td colSpan={2}>TOTAL</Td>
                <Td className="text-right tabular-nums text-rose-700">{currency.format(jpd.totalOmset)}</Td>
                <Td className="text-right tabular-nums">{jpd.totalSemuaProduk}</Td>
                <Td className="text-right tabular-nums">{jpd.totalProdukKetul}</Td>
                <Td className="text-right tabular-nums">{jpd.totalProdukKetul}</Td>
                <Td className="text-right tabular-nums">{number0.format(jpd.totalDagingKg)}</Td>
                <Td className="text-right tabular-nums">{number0.format(jpd.finalAvgYield)}</Td>
                <Td className="text-right tabular-nums">{number0.format(jpd.finalAvgSales)}</Td>
              </Tr>
            </tbody>
          </Table>
        </div>
      </Card>

      {/* b. Purchase Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>b. Purchase Sheet</CardTitle>
          <p className="text-xs text-slate-400">Barang Masuk = data dari akun Pramuniaga (Inventory Record). Ditambah pembelian lokal manual di bawah.</p>
        </CardHeader>
        <div className="border-b border-slate-100 p-5">
          <OutletPurchaseForm outletId={outletId} materials={materialsForForms} />
        </div>
        <Table>
          <Thead>
            <tr>
              <Th>Tanggal</Th>
              <Th>Deskripsi</Th>
              <Th>Sumber</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Nominal</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {purchase.receivedRows.map((r, i) => (
              <Tr key={`recv-${i}`}>
                <Td>{r.date.toLocaleDateString("id-ID")}</Td>
                <Td>{r.description}</Td>
                <Td>
                  <Badge tone="info">Pramuniaga</Badge>
                </Td>
                <Td className="text-right">
                  {r.qty} {r.unit}
                </Td>
                <Td className="text-right font-semibold">{currency.format(r.amount)}</Td>
                <Td></Td>
              </Tr>
            ))}
            {purchase.manualRows.map((p) => (
              <Tr key={p.id}>
                <Td>{p.date.toLocaleDateString("id-ID")}</Td>
                <Td>{p.description}</Td>
                <Td>
                  <Badge tone="neutral">Manual — {p.category}</Badge>
                </Td>
                <Td className="text-right">
                  {p.qty} {p.unit}
                </Td>
                <Td className="text-right font-semibold">{currency.format(p.amount)}</Td>
                <Td>
                  <OutletPurchaseDeleteButton id={p.id} />
                </Td>
              </Tr>
            ))}
            {purchase.receivedRows.length === 0 && purchase.manualRows.length === 0 && <EmptyRow colSpan={6}>Belum ada pembelian bulan ini.</EmptyRow>}
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td colSpan={4}>TOTAL PURCHASE</Td>
              <Td className="text-right">{currency.format(purchase.total)}</Td>
              <Td></Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      {/* c. Adjustment Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>c. Adjustment Sheet</CardTitle>
        </CardHeader>
        <div className="border-b border-slate-100 p-5">
          <OutletAdjustmentForm outletId={outletId} materials={materialsForForms} />
        </div>
        <Table>
          <Thead>
            <tr>
              <Th>Tanggal</Th>
              <Th>Jenis</Th>
              <Th>Deskripsi</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Nominal</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {adjustment.rows.map((r) => (
              <Tr key={r.id}>
                <Td>{r.date.toLocaleDateString("id-ID")}</Td>
                <Td>
                  <Badge tone={r.type === "RUSAK" ? "danger" : r.type === "REJECT" ? "warning" : r.type === "KELUAR" ? "info" : "neutral"}>
                    {ADJUSTMENT_TYPE_LABELS[r.type]}
                  </Badge>
                </Td>
                <Td>
                  {r.description}
                  {r.material && <span className="ml-1 text-xs text-slate-400">({r.material.name})</span>}
                </Td>
                <Td className="text-right">{Number(r.qty)}</Td>
                <Td className="text-right font-semibold">{currency.format(Number(r.amount))}</Td>
                <Td>
                  <OutletAdjustmentDeleteButton id={r.id} />
                </Td>
              </Tr>
            ))}
            {adjustment.rows.length === 0 && <EmptyRow colSpan={6}>Belum ada adjustment bulan ini.</EmptyRow>}
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td colSpan={4}>TOTAL ADJUSTMENT (Rusak + Reject + Selisih)</Td>
              <Td className="text-right">{currency.format(adjustment.total)}</Td>
              <Td></Td>
            </Tr>
            <Tr className="text-slate-500">
              <Td colSpan={4}>Total Barang Keluar (Mutasi — bukan kerugian, tidak dihitung ke total di atas)</Td>
              <Td className="text-right">{currency.format(adjustment.totalKeluar)}</Td>
              <Td></Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      {/* d. Jurnal Sheet — Ledger (input manual, format spreadsheet asli) */}
      <Card>
        <CardHeader>
          <CardTitle>d. Jurnal Sheet</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-slate-400">Tanggal / No. Akun / Keterangan / D-C / Nilai — dicatat manual, sama seperti kebiasaan pembukuan harian.</p>
            <Link href="/admin/outlet-ledger-accounts" className="text-xs font-bold text-accent-700 hover:text-accent-800">
              Kelola Chart of Accounts →
            </Link>
          </div>
        </CardHeader>
        <div className="border-b border-slate-100 p-5">
          <OutletLedgerEntryForm outletId={outletId} accounts={ledgerAccountOptions} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>No. Akun</Th>
                <Th>Nama Akun</Th>
                <Th>Keterangan</Th>
                <Th className="text-center">D/C</Th>
                <Th className="text-right">Nilai (Rp.)</Th>
                <Th className="text-right">Accum.</Th>
                <Th className="text-right">Total/Day</Th>
                <Th></Th>
              </tr>
            </Thead>
            <tbody>
              {ledger.dayGroups.map((group) =>
                group.rows.map((row, i) => (
                  <Tr key={row.id}>
                    <Td className="font-medium text-slate-900">{i === 0 ? row.date.getUTCDate() : ""}</Td>
                    <Td className="font-mono text-xs text-slate-400">{row.accountNumber}</Td>
                    <Td>{row.accountLabel}</Td>
                    <Td>{row.description}</Td>
                    <Td className="text-center">
                      <Badge tone={row.side === "D" ? "info" : "danger"}>{row.side}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{currency.format(row.amount)}</Td>
                    <Td className="text-right tabular-nums">{row.accum < 0 ? `(${currency.format(Math.abs(row.accum))})` : currency.format(row.accum)}</Td>
                    <Td className="text-right font-bold tabular-nums text-rose-700">
                      {i === 0 ? (group.totalDay < 0 ? `(${currency.format(Math.abs(group.totalDay))})` : currency.format(group.totalDay)) : ""}
                    </Td>
                    <Td>
                      <OutletLedgerEntryDeleteButton id={row.id} />
                    </Td>
                  </Tr>
                )),
              )}
              {ledger.dayGroups.length === 0 && <EmptyRow colSpan={9}>Belum ada baris Jurnal Sheet bulan ini.</EmptyRow>}
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td colSpan={5}>TOTAL (D − C)</Td>
                <Td className="text-right tabular-nums">
                  {currency.format(ledger.totalDebit)} / {currency.format(ledger.totalCredit)}
                </Td>
                <Td className="text-right tabular-nums" colSpan={2}>
                  {ledger.endingBalance < 0 ? `(${currency.format(Math.abs(ledger.endingBalance))})` : currency.format(ledger.endingBalance)}
                </Td>
                <Td></Td>
              </Tr>
            </tbody>
          </Table>
        </div>
      </Card>

      {/* e. Absen Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>e. Absen Sheet</CardTitle>
          <p className="text-xs text-slate-400">
            {outletCode} {outlet.name} — {MONTH_NAMES[month - 1]} {year}
          </p>
        </CardHeader>
        <div className="grid grid-cols-3 gap-4 border-b border-slate-100 p-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-400">Omset (Bulan Ini)</p>
            <p className="font-bold text-brand-900">{currency.format(absen.totalOmsetBulan)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">AVG Sales (Qty / Hari Hadir)</p>
            <p className="font-bold text-brand-900">{Math.round(absen.avgSalesPerAbsen)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">AVG Beef Used (Kg / Hari Hadir)</p>
            <p className="font-bold text-brand-900">{Math.round(insentive.avgBeef)}</p>
          </div>
        </div>
        {!absen.bracketsConfigured && (
          <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Belum ada bracket insentif aktif — atur di &quot;Bracket Insentif Outlet&quot; agar Insentive Value terisi.
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <tr>
                <Th>No.</Th>
                <Th>Nama</Th>
                <Th>Outlet</Th>
                <Th className="text-right">Qty Sales</Th>
                <Th className="text-right">Insentive Value</Th>
                <Th className="text-right">Labor Cost</Th>
                <Th className="text-right">Gaji Pokok</Th>
                {Array.from({ length: absen.nDays }, (_, i) => {
                  const date = new Date(Date.UTC(year, month - 1, i + 1));
                  const isSunday = date.getUTCDay() === 0;
                  return (
                    <Th key={i} className={`text-center ${isSunday ? "text-rose-600" : ""}`}>
                      <div>{String(i + 1).padStart(2, "0")}</div>
                      <div className="font-normal normal-case">{HARI_NAMES[date.getUTCDay()]}</div>
                    </Th>
                  );
                })}
                <Th className="text-right">Total Standby</Th>
                <Th className="text-right">Masa non Insentive</Th>
                <Th className="text-right">Total Absen</Th>
                <Th className="text-right">Total Salary</Th>
                <Th>Remarks</Th>
              </tr>
            </Thead>
            <tbody>
              {absen.rows.map((r, idx) => (
                <Tr key={r.userId}>
                  <Td>{idx + 1}</Td>
                  <Td className="font-medium text-slate-900">{r.name}</Td>
                  <Td>{outlet.name}</Td>
                  <Td className="text-right tabular-nums">{Math.round(r.qtySales)}</Td>
                  <Td className="text-right tabular-nums">{currency.format(r.insentiveValue)}</Td>
                  <Td colSpan={2}>
                    <OutletPayrollInput
                      outletId={outletId}
                      userId={r.userId}
                      year={year}
                      month={month}
                      defaultLaborCost={r.laborCost}
                      defaultBaseSalary={r.baseSalary}
                      recorded={r.payrollRecorded}
                    />
                  </Td>
                  {r.attendance.map((present, i) => (
                    <Td key={i} className="text-center text-xs text-slate-500">
                      {present ? outletCode : ""}
                    </Td>
                  ))}
                  <Td className="text-right font-semibold tabular-nums">{r.totalStandby}</Td>
                  <Td className="text-right tabular-nums">{r.totalNonInsentif}</Td>
                  <Td className="text-right tabular-nums">{absen.nDays}</Td>
                  <Td className="text-right font-semibold tabular-nums" title={`(${r.totalStandby} hari kerja / 27) × ${currency.format(r.baseSalary)} Gaji Pokok`}>
                    {currency.format(r.totalSalary)}
                  </Td>
                  <Td></Td>
                </Tr>
              ))}
              {absen.rows.length === 0 && <EmptyRow colSpan={absen.nDays + 12}>Belum ada data absensi/omset harian bulan ini.</EmptyRow>}
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td colSpan={3}>TOTAL</Td>
                <Td className="text-right tabular-nums">{Math.round(absen.totalQtySales)}</Td>
                <Td className="text-right tabular-nums">{currency.format(absen.totalInsentiveValue)}</Td>
                <Td className="text-right tabular-nums" colSpan={2}>
                  Labor {currency.format(absen.rows.reduce((s, r) => s + r.laborCost, 0))}
                </Td>
                <Td colSpan={absen.nDays}></Td>
                <Td className="text-right tabular-nums">{absen.totalStandbyAll}</Td>
                <Td colSpan={2}></Td>
                <Td className="text-right tabular-nums">{currency.format(absen.rows.reduce((s, r) => s + r.totalSalary, 0))}</Td>
                <Td></Td>
              </Tr>
            </tbody>
          </Table>
        </div>
        <p className="px-5 py-3 text-xs text-slate-400">
          Labor Cost &amp; Gaji Pokok diisi manual per pramuniaga (belum ada data gaji pokok/HR untuk dihitung otomatis) — kolom berlatar kuning berarti
          belum pernah diisi bulan ini. Total Salary dihitung otomatis: (Hari Kerja ÷ 27) × Gaji Pokok.
        </p>
      </Card>

      {/* f. Insentive Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>f. Insentive Sheet</CardTitle>
          <Link href="/admin/incentive-brackets" className="text-xs font-bold text-accent-700 hover:text-accent-800">
            Kelola Bracket Omset →
          </Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <tr>
                <Th>Hari</Th>
                <Th>Tanggal</Th>
                <Th className="text-right">Total Omset (Rp.)</Th>
                {insentive.brackets.map((b) => (
                  <Th key={b.id} colSpan={2} className="text-center">
                    Range Omset {b.label}
                  </Th>
                ))}
                <Th className="text-right">Achieve Omset</Th>
                <Th className="text-right">Insentive</Th>
              </tr>
            </Thead>
            <tbody>
              {insentive.days.map((d, i) => (
                <Tr key={i}>
                  <Td>{HARI_NAMES[d.date.getUTCDay()]}</Td>
                  <Td>{d.date.toLocaleDateString("id-ID")}</Td>
                  <Td className="text-right tabular-nums">{currency.format(d.omset)}</Td>
                  {insentive.brackets.map((b) => {
                    const matched = d.bracket && d.bracket.label === b.label;
                    return (
                      <Td key={b.id} colSpan={2} className={`text-right tabular-nums ${matched ? "font-semibold text-brand-900" : "text-slate-300"}`}>
                        {matched ? currency.format(d.totalInsentifHari) : "0"}
                      </Td>
                    );
                  })}
                  <Td className="text-right tabular-nums">{currency.format(d.omset)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{currency.format(d.totalInsentifHari)}</Td>
                </Tr>
              ))}
              {insentive.days.length === 0 && <EmptyRow colSpan={5 + insentive.brackets.length * 2}>Belum ada data.</EmptyRow>}
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td colSpan={3}>TOTAL</Td>
                <Td colSpan={insentive.brackets.length * 2}></Td>
                <Td className="text-right tabular-nums">{currency.format(insentive.omsetBersih)}</Td>
                <Td className="text-right tabular-nums">{currency.format(insentive.totalInsentifHari)}</Td>
              </Tr>
            </tbody>
          </Table>
        </div>

        <p className="mt-4 px-5 text-xs font-bold uppercase tracking-wide text-slate-400">Rekap Insentif per Pramuniaga</p>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th className="text-right">Total Hadir</Th>
              <Th className="text-right">Insentif</Th>
            </tr>
          </Thead>
          <tbody>
            {insentive.absenRows.map((r) => (
              <Tr key={r.userId}>
                <Td className="font-medium text-slate-900">{r.name}</Td>
                <Td className="text-right tabular-nums">{r.totalStandby}</Td>
                <Td className="text-right font-semibold tabular-nums">{currency.format(r.insentiveValue)}</Td>
              </Tr>
            ))}
            {insentive.absenRows.length === 0 && <EmptyRow colSpan={3}>Belum ada data.</EmptyRow>}
          </tbody>
        </Table>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-slate-100 p-5 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Opening Day</p>
            <p className="font-bold text-brand-900">{insentive.openingDay}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Royalti</p>
            <p className="font-bold text-brand-900">{currency.format(insentive.royalti)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Insentive Officer</p>
            <p className="font-bold text-brand-900">{currency.format(insentive.insentiveOfficer)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Insentive Head</p>
            <p className="font-bold text-brand-900">{currency.format(insentive.insentiveHead)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Omset Bersih</p>
            <p className="font-bold text-brand-900">{currency.format(insentive.omsetBersih)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">AVG Sales</p>
            <p className="font-bold text-brand-900">{number2.format(insentive.avgSales)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">AVG Beef</p>
            <p className="font-bold text-brand-900">{number2.format(insentive.avgBeef)}</p>
          </div>
        </div>
        <p className="px-5 pb-4 text-xs text-slate-400">
          Belum termasuk: tabel &quot;KALKULASI Insentive Controller&quot; (skema insentif berbasis Qty untuk role Controller) dari spreadsheet asli — belum
          ada peran/skema itu di sistem ini. Beri tahu kami detailnya agar bisa ditambahkan.
        </p>
      </Card>

      {/* g. Inventory Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>g. Inventory Sheet — Data Stock Available</CardTitle>
          <p className="text-xs text-slate-400">Kolom &quot;Akhir&quot; diisi manual (hasil stock opname); kolom lain otomatis dari transaksi bulan ini.</p>
        </CardHeader>
        {[...materialsByCategory.entries()].map(([category, rows]) => (
          <div key={category} className="border-b border-slate-100">
            <p className="bg-slate-50 px-5 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">{MATERIAL_CATEGORY_LABELS[category] ?? category}</p>
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <tr>
                    <Th>Kode</Th>
                    <Th>Nama</Th>
                    <Th>Satuan</Th>
                    <Th className="text-right">Awal</Th>
                    <Th className="text-right">Masuk</Th>
                    <Th className="text-right">Pakai</Th>
                    <Th className="text-right">Rusak</Th>
                    <Th className="text-right">Reject</Th>
                    <Th className="text-right">Selisih</Th>
                    <Th className="text-right">Akhir</Th>
                    <Th className="text-right">Nilai Akhir</Th>
                  </tr>
                </Thead>
                <tbody>
                  {rows.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-mono text-xs text-slate-400">{r.code}</Td>
                      <Td>{r.name}</Td>
                      <Td>{r.unit}</Td>
                      <Td className="text-right tabular-nums">{number0.format(r.awalQty)}</Td>
                      <Td className="text-right tabular-nums">{number0.format(r.masukQty)}</Td>
                      <Td className="text-right tabular-nums text-slate-500">{number0.format(r.pakaiQty)}</Td>
                      <Td className="text-right tabular-nums text-rose-600">{r.rusakQty > 0 ? number0.format(r.rusakQty) : "-"}</Td>
                      <Td className="text-right tabular-nums text-amber-600">{r.rejectQty > 0 ? number0.format(r.rejectQty) : "-"}</Td>
                      <Td className="text-right tabular-nums">{r.selisihQty !== 0 ? number0.format(r.selisihQty) : "-"}</Td>
                      <Td className="text-right">
                        <OutletMaterialAkhirInput outletId={outletId} materialId={r.id} year={year} month={month} defaultValue={r.akhirQty} recorded={r.akhirRecorded} />
                      </Td>
                      <Td className="text-right font-semibold tabular-nums">{currency.format(r.akhirQty * r.unitPrice)}</Td>
                    </Tr>
                  ))}
                  {rows.length === 0 && <EmptyRow colSpan={11}>Belum ada material di kategori ini.</EmptyRow>}
                </tbody>
              </Table>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg bg-gold-50 px-5 py-3 font-bold text-brand-900">
          <span>TOTAL NILAI STOCK AKHIR</span>
          <span>{currency.format(inventory.totalAkhirNominal)}</span>
        </div>
      </Card>

      {/* h. Report Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>h. Report Sheet</CardTitle>
          <p className="text-xs text-slate-400">
            Diambil langsung dari Jurnal Sheet bulan ini ({MONTH_NAMES[month - 1]} {year}) — bukan hasil hitung otomatis dari transaksi/pengeluaran.
          </p>
        </CardHeader>
        <div className="p-5 pt-2 text-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">A. Penjualan</p>
          <Table>
            <tbody>
              {report.penjualanRows
                .filter((r) => r.amount !== 0)
                .map((r) => (
                  <Tr key={r.number}>
                    <Td>{r.label}</Td>
                    <Td className="text-right tabular-nums">{currency.format(Math.abs(r.amount))}</Td>
                  </Tr>
                ))}
              {report.penjualanRows.every((r) => r.amount === 0) && <EmptyRow colSpan={2}>Belum ada transaksi penjualan di jurnal bulan ini.</EmptyRow>}
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td>TOTAL PENJUALAN</Td>
                <Td className="text-right tabular-nums">{currency.format(report.totalPenjualan)}</Td>
              </Tr>
            </tbody>
          </Table>

          <p className="mb-1 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">B. Pembelian</p>
          <Table>
            <tbody>
              {report.pembelianRows.map((r, i) => (
                <Tr key={i}>
                  <Td>{r.label}</Td>
                  <Td className="text-right tabular-nums">{currency.format(Math.abs(r.amount))}</Td>
                </Tr>
              ))}
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td>TOTAL HPP</Td>
                <Td className="text-right tabular-nums">{currency.format(report.totalHpp)}</Td>
              </Tr>
            </tbody>
          </Table>
          <div className={`mt-2 flex items-center justify-between rounded-lg px-3 py-2 font-bold ${report.labaKotor < 0 ? "bg-rose-50 text-rose-700" : "bg-brand-50 text-brand-900"}`}>
            <span>LABA/RUGI KOTOR</span>
            <span>{currency.format(report.labaKotor)}</span>
          </div>

          <p className="mb-1 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">C. Biaya</p>
          <Table>
            <tbody>
              <Tr className="bg-slate-50">
                <Td className="font-semibold" colSpan={2}>
                  Overhead Langsung
                </Td>
              </Tr>
              {report.overheadLangsungRows.map((r) => (
                <Tr key={r.number}>
                  <Td>{r.label}</Td>
                  <Td className="text-right tabular-nums">{currency.format(Math.abs(r.amount))}</Td>
                </Tr>
              ))}
              <Tr className="font-semibold">
                <Td>Total Overhead Langsung</Td>
                <Td className="text-right tabular-nums">{currency.format(report.totalOverheadLangsung)}</Td>
              </Tr>
              <Tr className="bg-slate-50">
                <Td className="font-semibold" colSpan={2}>
                  Overhead Tidak Langsung
                </Td>
              </Tr>
              {report.overheadTidakLangsungRows.map((r) => (
                <Tr key={r.number}>
                  <Td>{r.label}</Td>
                  <Td className="text-right tabular-nums">{currency.format(Math.abs(r.amount))}</Td>
                </Tr>
              ))}
              <Tr className="font-semibold">
                <Td>Total Overhead Tidak Langsung</Td>
                <Td className="text-right tabular-nums">{currency.format(report.totalOverheadTidakLangsung)}</Td>
              </Tr>
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td>TOTAL BIAYA</Td>
                <Td className="text-right tabular-nums">{currency.format(report.totalBiaya)}</Td>
              </Tr>
            </tbody>
          </Table>
          <div className={`mt-2 flex items-center justify-between rounded-lg px-3 py-3 font-bold ${reportLabaBersih < 0 ? "bg-rose-50 text-rose-700" : "bg-brand-50 text-brand-900"}`}>
            <span>LABA/RUGI BERSIH</span>
            <span>{currency.format(reportLabaBersih)}</span>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <FileBarChart className="h-3.5 w-3.5" />
            {outlet.name} — {MONTH_NAMES[month - 1]} {year} — Insentif per hitungan bracket (referensi, di luar jurnal): {currency.format(totalInsentifSemua)} —
            Nilai stock akhir Inventory Sheet: {currency.format(inventory.totalAkhirNominal)}
          </div>
        </div>
      </Card>
    </div>
  );
}
