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
import { OutletReportSelector } from "@/components/finance/outlet-report-selector";
import { getOmsetSheet, getPurchaseSheet, getAdjustmentSheet, getAkunSheet, getAbsenInsentiveSheet, getInventorySheet } from "@/lib/outlet-report";
import { Wallet, ShoppingBag, AlertTriangle, Sparkles, FileBarChart } from "lucide-react";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const number0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  BAHAN_UTAMA: "Bahan Utama",
  BAHAN_BAKU_TAMBAHAN: "Bahan Baku Tambahan",
  PACKAGING: "Packaging",
  BAHAN_ALAT_PENDUKUNG: "Bahan & Alat Pendukung",
};
const ADJUSTMENT_TYPE_LABELS: Record<string, string> = { RUSAK: "Barang Rusak", REJECT: "Barang Reject", SELISIH: "Barang Selisih" };

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

  const [outlet, allOutlets, materials] = await Promise.all([
    prisma.outlet.findUnique({ where: { id: outletId }, include: { region: true } }),
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.outletMaterial.findMany({ where: { status: "ACTIVE" }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
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

  const [omset, purchase, adjustment, inventory, absenInsentive] = await Promise.all([
    getOmsetSheet(outletId, year, month),
    getPurchaseSheet(outletId, year, month),
    getAdjustmentSheet(outletId, year, month),
    getInventorySheet(outletId, year, month),
    getAbsenInsentiveSheet(outletId, year, month),
  ]);
  const akun = await getAkunSheet(outletId, year, month, purchase);

  const materialsForForms = materials.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }));
  const materialsByCategory = new Map<string, typeof inventory.rows>();
  for (const r of inventory.rows) materialsByCategory.set(r.category, [...(materialsByCategory.get(r.category) ?? []), r]);

  // ── h. Report Sheet — the investor-facing summary ─────────────────────
  const reportLabaBersih = akun.labaBersih - absenInsentive.totalInsentif;

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
        <StatCard label="Total Insentif" value={currency.format(absenInsentive.totalInsentif)} tone="info" icon={<Sparkles className="h-4 w-4" />} />
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
                <Th className="text-right">Total Qty</Th>
                <Th className="text-right">Kg Ketul</Th>
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
                  <Td className="text-right font-semibold tabular-nums">{d.qtyAllProducts}</Td>
                  <Td className="text-right tabular-nums">{number0.format(d.kgDagingKetul)}</Td>
                </Tr>
              ))}
              {omset.days.every((d) => d.qtyAllProducts === 0) && (
                <EmptyRow colSpan={omset.items.length + 4}>Belum ada penjualan tercatat bulan ini.</EmptyRow>
              )}
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td className="sticky left-0 z-10 bg-gold-50">TOTAL</Td>
                <Td className="text-right tabular-nums">{currency.format(omset.totalOmset)}</Td>
                {omset.items.map((it) => (
                  <Td key={it.key} className="text-right tabular-nums">
                    {omset.days.reduce((s, d) => s + (d.qtyByKey[it.key] ?? 0), 0)}
                  </Td>
                ))}
                <Td className="text-right tabular-nums">{omset.days.reduce((s, d) => s + d.qtyAllProducts, 0)}</Td>
                <Td className="text-right tabular-nums">{number0.format(omset.days.reduce((s, d) => s + d.kgDagingKetul, 0))}</Td>
              </Tr>
            </tbody>
          </Table>
        </div>
        {omset.cumulative.length > 0 && (
          <div className="grid grid-cols-3 gap-4 border-t border-slate-100 p-5 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Kumulatif Qty Semua Produk</p>
              <p className="font-bold text-brand-900">{omset.cumulative.at(-1)?.qtyAllProducts ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Kumulatif Qty Produk Ketul</p>
              <p className="font-bold text-brand-900">{omset.cumulative.at(-1)?.qtyDagingKetulProducts ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Kumulatif Kg Daging Ketul</p>
              <p className="font-bold text-brand-900">{number0.format(omset.cumulative.at(-1)?.kgDagingKetul ?? 0)} Kg</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Rata-rata Pcs per 4 Kg</p>
              <p className="font-bold text-brand-900">{omset.cumulative.at(-1)?.pcsPer4Kg ?? 0} pcs</p>
            </div>
          </div>
        )}
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
                  <Badge tone={r.type === "RUSAK" ? "danger" : r.type === "REJECT" ? "warning" : "neutral"}>{ADJUSTMENT_TYPE_LABELS[r.type]}</Badge>
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
          </tbody>
        </Table>
      </Card>

      {/* d. Akun Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>d. Akun Sheet</CardTitle>
          <p className="text-xs text-slate-400">A. Penjualan (per channel) — B. Pembelian (HPP) — C. Biaya (Overhead Langsung/Tidak Langsung).</p>
        </CardHeader>
        <div className="p-5 pt-2">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">A. Penjualan</p>
          <Table>
            <Thead>
              <tr>
                <Th>Channel</Th>
                <Th className="text-right">Penjualan</Th>
                <Th className="text-right">Potongan</Th>
              </tr>
            </Thead>
            <tbody>
              {akun.penjualanRows.map((r) => (
                <Tr key={r.channel}>
                  <Td>{r.label}</Td>
                  <Td className="text-right">{currency.format(r.penjualan)}</Td>
                  <Td className="text-right text-rose-600">{r.potongan > 0 ? `(${currency.format(r.potongan)})` : "-"}</Td>
                </Tr>
              ))}
              {akun.penjualanRows.length === 0 && <EmptyRow colSpan={3}>Belum ada penjualan.</EmptyRow>}
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td>Total Penjualan (Bersih)</Td>
                <Td className="text-right" colSpan={2}>
                  {currency.format(akun.totalPenjualan)}
                </Td>
              </Tr>
            </tbody>
          </Table>

          <p className="mb-1 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">B. Pembelian (HPP)</p>
          <Table>
            <tbody>
              {akun.pembelianRows.map((r, i) => (
                <Tr key={i}>
                  <Td>{r.label}</Td>
                  <Td className="text-right">{r.amount < 0 ? `(${currency.format(Math.abs(r.amount))})` : currency.format(r.amount)}</Td>
                </Tr>
              ))}
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td>Total HPP</Td>
                <Td className="text-right">{currency.format(akun.totalHpp)}</Td>
              </Tr>
              <Tr className="font-bold text-brand-900">
                <Td>Laba Kotor (Penjualan − HPP)</Td>
                <Td className="text-right">{currency.format(akun.labaKotor)}</Td>
              </Tr>
            </tbody>
          </Table>

          <p className="mb-1 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">C. Biaya</p>
          <Table>
            <tbody>
              <Tr className="bg-slate-50">
                <Td className="font-semibold" colSpan={2}>
                  Overhead Langsung
                </Td>
              </Tr>
              {akun.overheadLangsungRows.map((r, i) => (
                <Tr key={i}>
                  <Td>{r.label}</Td>
                  <Td className="text-right">{currency.format(r.amount)}</Td>
                </Tr>
              ))}
              {akun.overheadLangsungRows.length === 0 && <EmptyRow colSpan={2}>Tidak ada.</EmptyRow>}
              <Tr className="font-semibold">
                <Td>Sub-total Overhead Langsung</Td>
                <Td className="text-right">{currency.format(akun.totalOverheadLangsung)}</Td>
              </Tr>
              <Tr className="bg-slate-50">
                <Td className="font-semibold" colSpan={2}>
                  Overhead Tidak Langsung
                </Td>
              </Tr>
              {akun.overheadTidakLangsungRows.map((r, i) => (
                <Tr key={i}>
                  <Td>{r.label}</Td>
                  <Td className="text-right">{currency.format(r.amount)}</Td>
                </Tr>
              ))}
              {akun.overheadTidakLangsungRows.length === 0 && <EmptyRow colSpan={2}>Tidak ada.</EmptyRow>}
              <Tr className="font-semibold">
                <Td>Sub-total Overhead Tidak Langsung</Td>
                <Td className="text-right">{currency.format(akun.totalOverheadTidakLangsung)}</Td>
              </Tr>
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td>Total Biaya</Td>
                <Td className="text-right">{currency.format(akun.totalBiaya)}</Td>
              </Tr>
              <Tr className="bg-brand-50 font-bold text-brand-900">
                <Td>Laba/Rugi Bersih (sebelum Insentif)</Td>
                <Td className="text-right">{currency.format(akun.labaBersih)}</Td>
              </Tr>
            </tbody>
          </Table>
        </div>
      </Card>

      {/* e+f. Absen + Insentive Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>e+f. Absen &amp; Insentive Sheet</CardTitle>
          <Link href="/admin/incentive-brackets" className="text-xs font-bold text-accent-700 hover:text-accent-800">
            Kelola Bracket Omset →
          </Link>
        </CardHeader>
        {!absenInsentive.bracketsConfigured && (
          <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Belum ada bracket insentif aktif — atur di &quot;Bracket Insentif Outlet&quot; agar sheet ini terisi.
          </div>
        )}
        <Table>
          <Thead>
            <tr>
              <Th>Pramuniaga</Th>
              <Th className="text-right">Hari Hadir</Th>
              <Th className="text-right">Insentif</Th>
            </tr>
          </Thead>
          <tbody>
            {absenInsentive.employees.map((e) => (
              <Tr key={e.name}>
                <Td className="font-medium text-slate-900">{e.name}</Td>
                <Td className="text-right">{e.hadir}</Td>
                <Td className="text-right font-semibold">{currency.format(e.insentif)}</Td>
              </Tr>
            ))}
            {absenInsentive.employees.length === 0 && <EmptyRow colSpan={3}>Belum ada data absensi/omset harian bulan ini.</EmptyRow>}
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td colSpan={2}>TOTAL INSENTIF</Td>
              <Td className="text-right">{currency.format(absenInsentive.totalInsentif)}</Td>
            </Tr>
          </tbody>
        </Table>
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
                    <Th className="text-right">Rusak</Th>
                    <Th className="text-right">Reject</Th>
                    <Th className="text-right">Selisih</Th>
                    <Th className="text-right">Pakai</Th>
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
                      <Td className="text-right tabular-nums text-rose-600">{r.rusakQty > 0 ? number0.format(r.rusakQty) : "-"}</Td>
                      <Td className="text-right tabular-nums text-amber-600">{r.rejectQty > 0 ? number0.format(r.rejectQty) : "-"}</Td>
                      <Td className="text-right tabular-nums">{r.selisihQty !== 0 ? number0.format(r.selisihQty) : "-"}</Td>
                      <Td className="text-right tabular-nums text-slate-500">{number0.format(r.pakaiQty)}</Td>
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
          <CardTitle>h. Report Sheet — Ringkasan untuk Investor</CardTitle>
        </CardHeader>
        <div className="space-y-1 p-5 pt-2 text-sm">
          <div className="flex items-center justify-between border-b border-slate-100 py-2">
            <span className="text-slate-600">Total Penjualan (Bersih)</span>
            <span className="font-semibold text-brand-900">{currency.format(akun.totalPenjualan)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 py-2">
            <span className="text-slate-600">(-) Total HPP (Pembelian)</span>
            <span className="font-semibold text-rose-700">({currency.format(akun.totalHpp)})</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 py-2 font-semibold">
            <span className="text-slate-700">Laba Kotor</span>
            <span className="text-brand-900">{currency.format(akun.labaKotor)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 py-2">
            <span className="text-slate-600">(-) Total Biaya (Overhead)</span>
            <span className="font-semibold text-rose-700">({currency.format(akun.totalBiaya)})</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 py-2">
            <span className="text-slate-600">(-) Total Insentif Pramuniaga</span>
            <span className="font-semibold text-rose-700">({currency.format(absenInsentive.totalInsentif)})</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gold-50 px-3 py-3 font-bold text-brand-900">
            <span>LABA/RUGI BERSIH OUTLET</span>
            <span>{currency.format(reportLabaBersih)}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <FileBarChart className="h-3.5 w-3.5" />
            {outlet.name} — {MONTH_NAMES[month - 1]} {year} — Nilai stock akhir: {currency.format(inventory.totalAkhirNominal)}
          </div>
        </div>
      </Card>
    </div>
  );
}
