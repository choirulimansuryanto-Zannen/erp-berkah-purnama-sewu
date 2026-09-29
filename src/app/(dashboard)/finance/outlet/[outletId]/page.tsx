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
import { OutletReportSelector } from "@/components/finance/outlet-report-selector";
import { getCompanyMonthlyFigures, INCENTIVE_TYPE_LABELS } from "@/lib/incentive";
import { Wallet, ShoppingBag, AlertTriangle, BookOpen, Users, Sparkles, Boxes, FileBarChart } from "lucide-react";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ATTENDANCE_STATUS_LABELS: Record<string, string> = { PRESENT: "Hadir", LATE: "Terlambat", ABSENT: "Absen", OFF: "Libur", SAKIT: "Sakit" };

function monthRange(year: number, month: number) {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)) };
}

// Laporan Outlet — one outlet, one month, all 8 sheets from the source
// spec: Omset, Purchase, Adjustment, Akun, Absen, Insentive, Inventory,
// Report. Every sheet is derived from data that already exists elsewhere
// in the system (DailyReport, StockAdjustment, InventoryRecord,
// ExpenseRecord, AttendanceRecord, IncentiveCalculation) plus the one
// genuinely new input this report needed — OutletPurchase.
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

  const [outlet, allOutlets] = await Promise.all([
    prisma.outlet.findUnique({ where: { id: outletId }, include: { region: true } }),
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
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

  const { start, end } = monthRange(year, month);
  const yearStart = new Date(Date.UTC(year, 0, 1));

  const [
    dailyReports,
    purchases,
    stockAdjustments,
    inventoryRecordsMonth,
    inventoryRecordsBefore,
    expenses,
    attendance,
    incentiveCalcs,
    companyFigures,
  ] = await Promise.all([
    prisma.dailyReport.findMany({ where: { outletId, status: "APPROVED", date: { gte: start, lte: end } }, orderBy: { date: "asc" } }),
    prisma.outletPurchase.findMany({ where: { outletId, date: { gte: start, lte: end } }, include: { createdBy: { select: { name: true } } }, orderBy: { date: "asc" } }),
    prisma.stockAdjustment.findMany({ where: { outletId, status: "APPROVED", createdAt: { gte: start, lte: end } }, include: { product: true } }),
    prisma.inventoryRecord.findMany({ where: { outletId, date: { gte: start, lte: end } }, include: { product: true } }),
    prisma.inventoryRecord.findMany({ where: { outletId, date: { gte: yearStart, lt: start } }, include: { product: true }, orderBy: { date: "asc" } }),
    prisma.expenseRecord.findMany({ where: { outletId, approvalStatus: "APPROVED", date: { gte: start, lte: end } }, include: { categoryDef: true } }),
    prisma.attendanceRecord.findMany({ where: { outletId, date: { gte: start, lte: end } }, include: { user: { select: { name: true } } } }),
    prisma.incentiveCalculation.findMany({ where: { year, month, OR: [{ outletId }, { scope: "COMPANY" }] }, include: { rule: true } }),
    getCompanyMonthlyFigures(year, month),
  ]);

  // ── a. Omset Sheet ────────────────────────────────────────────────────
  const totalOmset = dailyReports.reduce((s, r) => s + Number(r.omset), 0);
  const totalNonTunai = dailyReports.reduce((s, r) => s + Number(r.nonTunai), 0);
  const totalSetoran = dailyReports.reduce((s, r) => s + Number(r.summarySetoran), 0);
  const totalVarianceOmset = dailyReports.reduce((s, r) => s + Number(r.variance), 0);

  // ── b. Purchase Sheet ─────────────────────────────────────────────────
  const totalPurchase = purchases.reduce((s, p) => s + Number(p.amount), 0);

  // ── c. Adjustment Sheet ───────────────────────────────────────────────
  const rusakQty = stockAdjustments.reduce((s, a) => s + Math.abs(a.qtyChange), 0);
  const rusakNominal = stockAdjustments.reduce((s, a) => s + Math.abs(a.qtyChange) * Number(a.product.cost), 0);
  const rejectQty = inventoryRecordsMonth.reduce((s, r) => s + r.rejected, 0);
  const rejectNominal = inventoryRecordsMonth.reduce((s, r) => s + r.rejected * Number(r.product.cost), 0);
  const selisihQty = inventoryRecordsMonth.reduce((s, r) => s + r.variance, 0);
  const selisihNominal = inventoryRecordsMonth.reduce((s, r) => s + r.variance * Number(r.product.cost), 0);
  const totalAdjustmentNominal = rusakNominal + rejectNominal + Math.abs(selisihNominal);

  // ── d. Akun Sheet — a formatted Debit/Kredit recap, not a real posted
  // ledger (see the FA Company 6-book journal for that) ─────────────────
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expensesByCategory = new Map<string, number>();
  for (const e of expenses) expensesByCategory.set(e.categoryDef.label, (expensesByCategory.get(e.categoryDef.label) ?? 0) + Number(e.amount));
  const akunRows = [
    { label: "Omset (Penjualan Outlet)", debit: 0, kredit: totalOmset },
    { label: "Setoran Fisik ke Kas", debit: totalSetoran, kredit: 0 },
    { label: "Pembelian Lokal (Purchase Sheet)", debit: totalPurchase, kredit: 0 },
    ...[...expensesByCategory.entries()].map(([name, amount]) => ({ label: `Beban — ${name}`, debit: amount, kredit: 0 })),
    { label: "Kerugian Barang Rusak/Reject/Selisih", debit: totalAdjustmentNominal, kredit: 0 },
  ];
  const akunTotalDebit = akunRows.reduce((s, r) => s + r.debit, 0);
  const akunTotalKredit = akunRows.reduce((s, r) => s + r.kredit, 0);

  // ── e. Absen Sheet ────────────────────────────────────────────────────
  const attendanceByUser = new Map<string, { name: string; counts: Record<string, number>; hours: number }>();
  for (const a of attendance) {
    const entry = attendanceByUser.get(a.userId) ?? { name: a.user.name, counts: {}, hours: 0 };
    entry.counts[a.status] = (entry.counts[a.status] ?? 0) + 1;
    entry.hours += Number(a.totalHours ?? 0);
    attendanceByUser.set(a.userId, entry);
  }

  // ── f. Insentive Sheet — direct outlet-scope rows, plus Officer/Head
  // Sales prorated by this outlet's share of company Omset this month
  // (those two are company-wide rules, not computed per outlet). ────────
  const directIncentives = incentiveCalcs.filter((c) => c.outletId === outletId);
  const companyIncentives = incentiveCalcs.filter((c) => c.scope === "COMPANY" && (c.type === "OFFICER_SALES" || c.type === "HEAD_SALES"));
  const outletShare = companyFigures.omset > 0 ? totalOmset / companyFigures.omset : 0;
  const proratedIncentives = companyIncentives.map((c) => ({
    type: c.type,
    amount: Number(c.amount) * outletShare,
  }));
  const totalInsentif = directIncentives.reduce((s, c) => s + Number(c.amount), 0) + proratedIncentives.reduce((s, c) => s + c.amount, 0);
  const royaltyRow = directIncentives.find((c) => c.type === "ROYALTY");

  // ── g. Inventory Sheet — Saldo Awal (carried forward), Masuk, Keluar,
  // Saldo Akhir, qty + nominal ───────────────────────────────────────────
  const lastBeforeByProduct = new Map<string, { balance: number; cost: number }>();
  for (const r of inventoryRecordsBefore) lastBeforeByProduct.set(r.productId, { balance: r.closingBalance, cost: Number(r.product.cost) });
  const productsInvolved = new Set([...inventoryRecordsBefore.map((r) => r.productId), ...inventoryRecordsMonth.map((r) => r.productId)]);
  let saldoAwalQty = 0;
  let saldoAwalNominal = 0;
  for (const productId of productsInvolved) {
    const before = lastBeforeByProduct.get(productId);
    if (before) {
      saldoAwalQty += before.balance;
      saldoAwalNominal += before.balance * before.cost;
    }
  }
  const masukQty = inventoryRecordsMonth.reduce((s, r) => s + r.received, 0);
  const masukNominal = inventoryRecordsMonth.reduce((s, r) => s + r.received * Number(r.product.cost), 0);
  const dipakaiQty = inventoryRecordsMonth.reduce((s, r) => s + r.used, 0);
  const dipakaiNominal = inventoryRecordsMonth.reduce((s, r) => s + r.used * Number(r.product.cost), 0);
  const keluarQty = dipakaiQty + rejectQty + rusakQty;
  const keluarNominal = dipakaiNominal + rejectNominal + rusakNominal;
  // Saldo Akhir per product = the LATEST record in-or-before this month.
  const lastInMonthByProduct = new Map<string, { balance: number; cost: number; date: Date }>();
  for (const r of inventoryRecordsMonth) {
    const existing = lastInMonthByProduct.get(r.productId);
    if (!existing || r.date > existing.date) lastInMonthByProduct.set(r.productId, { balance: r.closingBalance, cost: Number(r.product.cost), date: r.date });
  }
  let saldoAkhirQty = 0;
  let saldoAkhirNominal = 0;
  for (const productId of productsInvolved) {
    const latest = lastInMonthByProduct.get(productId) ?? (lastBeforeByProduct.get(productId) ? { ...lastBeforeByProduct.get(productId)!, date: new Date(0) } : undefined);
    if (latest) {
      saldoAkhirQty += latest.balance;
      saldoAkhirNominal += latest.balance * latest.cost;
    }
  }

  // ── h. Report Sheet — the investor-facing summary ─────────────────────
  const outletNetResult = totalOmset - totalPurchase - totalExpenses - totalAdjustmentNominal - totalInsentif;

  const years5 = years;

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
        <OutletReportSelector outlets={allOutlets} outletId={outletId} year={year} month={month} years={years5} />
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Omset" value={currency.format(totalOmset)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Total Purchase" value={currency.format(totalPurchase)} tone="accent" icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Total Adjustment" value={currency.format(totalAdjustmentNominal)} tone={totalAdjustmentNominal > 0 ? "warning" : "success"} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Total Insentif + Royalty" value={currency.format(totalInsentif)} tone="info" icon={<Sparkles className="h-4 w-4" />} />
      </div>

      {/* a. Omset Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>a. Omset Sheet ({dailyReports.length} laporan harian)</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Tanggal</Th>
              <Th className="text-right">Omset</Th>
              <Th className="text-right">Non-Tunai</Th>
              <Th className="text-right">Potongan</Th>
              <Th className="text-right">Setoran Fisik</Th>
              <Th className="text-right">Variance</Th>
            </tr>
          </Thead>
          <tbody>
            {dailyReports.map((r) => (
              <Tr key={r.id}>
                <Td>{r.date.toLocaleDateString("id-ID")}</Td>
                <Td className="text-right">{currency.format(Number(r.omset))}</Td>
                <Td className="text-right">{currency.format(Number(r.nonTunai))}</Td>
                <Td className="text-right">{currency.format(Number(r.potongan))}</Td>
                <Td className="text-right font-semibold">{currency.format(Number(r.summarySetoran))}</Td>
                <Td className="text-right">
                  <Badge tone={Math.abs(Number(r.variance)) < 1 ? "success" : "warning"}>{currency.format(Number(r.variance))}</Badge>
                </Td>
              </Tr>
            ))}
            {dailyReports.length === 0 && <EmptyRow colSpan={6}>Belum ada laporan harian terverifikasi bulan ini.</EmptyRow>}
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td>TOTAL</Td>
              <Td className="text-right">{currency.format(totalOmset)}</Td>
              <Td className="text-right">{currency.format(totalNonTunai)}</Td>
              <Td className="text-right">{currency.format(dailyReports.reduce((s, r) => s + Number(r.potongan), 0))}</Td>
              <Td className="text-right">{currency.format(totalSetoran)}</Td>
              <Td className="text-right">{currency.format(totalVarianceOmset)}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      {/* b. Purchase Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>b. Purchase Sheet ({purchases.length} pembelian)</CardTitle>
        </CardHeader>
        <div className="border-b border-slate-100 p-5">
          <OutletPurchaseForm outletId={outletId} />
        </div>
        <Table>
          <Thead>
            <tr>
              <Th>Tanggal</Th>
              <Th>Deskripsi</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Nominal</Th>
              <Th>Dicatat Oleh</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {purchases.map((p) => (
              <Tr key={p.id}>
                <Td>{p.date.toLocaleDateString("id-ID")}</Td>
                <Td>{p.description}</Td>
                <Td className="text-right">
                  {Number(p.qty)} {p.unit}
                </Td>
                <Td className="text-right font-semibold">{currency.format(Number(p.amount))}</Td>
                <Td className="text-xs text-slate-500">{p.createdBy.name}</Td>
                <Td>
                  <OutletPurchaseDeleteButton id={p.id} />
                </Td>
              </Tr>
            ))}
            {purchases.length === 0 && <EmptyRow colSpan={6}>Belum ada pembelian lokal bulan ini.</EmptyRow>}
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td colSpan={3}>TOTAL PURCHASE</Td>
              <Td className="text-right">{currency.format(totalPurchase)}</Td>
              <Td></Td>
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
        <Table>
          <Thead>
            <tr>
              <Th>Jenis</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Nominal</Th>
            </tr>
          </Thead>
          <tbody>
            <Tr>
              <Td>Barang Rusak</Td>
              <Td className="text-right">{rusakQty}</Td>
              <Td className="text-right">{currency.format(rusakNominal)}</Td>
            </Tr>
            <Tr>
              <Td>Barang Reject</Td>
              <Td className="text-right">{rejectQty}</Td>
              <Td className="text-right">{currency.format(rejectNominal)}</Td>
            </Tr>
            <Tr>
              <Td>Barang Selisih</Td>
              <Td className="text-right">{selisihQty}</Td>
              <Td className="text-right">{currency.format(selisihNominal)}</Td>
            </Tr>
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td>TOTAL ADJUSTMENT</Td>
              <Td className="text-right">{rusakQty + rejectQty + Math.abs(selisihQty)}</Td>
              <Td className="text-right">{currency.format(totalAdjustmentNominal)}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      {/* d. Akun Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>d. Akun Sheet</CardTitle>
          <p className="text-xs text-slate-400">Rekap format jurnal untuk laporan outlet — bukan jurnal FA Company (lihat Jurnal 6 Buku Kas untuk itu).</p>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Akun</Th>
              <Th className="text-right">Debit</Th>
              <Th className="text-right">Kredit</Th>
            </tr>
          </Thead>
          <tbody>
            {akunRows.map((r, i) => (
              <Tr key={i}>
                <Td>{r.label}</Td>
                <Td className="text-right">{r.debit > 0 ? currency.format(r.debit) : ""}</Td>
                <Td className="text-right">{r.kredit > 0 ? currency.format(r.kredit) : ""}</Td>
              </Tr>
            ))}
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td>JUMLAH</Td>
              <Td className="text-right">{currency.format(akunTotalDebit)}</Td>
              <Td className="text-right">{currency.format(akunTotalKredit)}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      {/* e. Absen Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>e. Absen Sheet — dasar perhitungan gaji Pramuniaga</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Pramuniaga</Th>
              <Th className="text-right">Hadir</Th>
              <Th className="text-right">Terlambat</Th>
              <Th className="text-right">Absen</Th>
              <Th className="text-right">Libur</Th>
              <Th className="text-right">Sakit</Th>
              <Th className="text-right">Total Jam</Th>
            </tr>
          </Thead>
          <tbody>
            {[...attendanceByUser.values()].map((u) => (
              <Tr key={u.name}>
                <Td className="font-medium text-slate-900">{u.name}</Td>
                <Td className="text-right">{u.counts.PRESENT ?? 0}</Td>
                <Td className="text-right">{u.counts.LATE ?? 0}</Td>
                <Td className="text-right">{u.counts.ABSENT ?? 0}</Td>
                <Td className="text-right">{u.counts.OFF ?? 0}</Td>
                <Td className="text-right">{u.counts.SAKIT ?? 0}</Td>
                <Td className="text-right">{u.hours.toFixed(1)}</Td>
              </Tr>
            ))}
            {attendanceByUser.size === 0 && <EmptyRow colSpan={7}>Belum ada data absensi bulan ini.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      {/* f. Insentive Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>f. Insentive Sheet</CardTitle>
          <Link href="/finance/insentif" className="text-xs font-bold text-accent-700 hover:text-accent-800">
            Kelola di Laporan Insentif →
          </Link>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Jenis</Th>
              <Th>Catatan</Th>
              <Th className="text-right">Nominal</Th>
            </tr>
          </Thead>
          <tbody>
            {directIncentives
              .filter((c) => c.type !== "ROYALTY")
              .map((c) => (
                <Tr key={c.id}>
                  <Td>{INCENTIVE_TYPE_LABELS[c.type]}</Td>
                  <Td className="text-xs text-slate-400">Langsung dari outlet ini</Td>
                  <Td className="text-right">{currency.format(Number(c.amount))}</Td>
                </Tr>
              ))}
            {proratedIncentives.map((c) => (
              <Tr key={c.type}>
                <Td>{INCENTIVE_TYPE_LABELS[c.type]}</Td>
                <Td className="text-xs text-slate-400">Dialokasikan {(outletShare * 100).toFixed(1)}% dari total perusahaan (kontribusi omset)</Td>
                <Td className="text-right">{currency.format(c.amount)}</Td>
              </Tr>
            ))}
            {royaltyRow && (
              <Tr>
                <Td>Royalty Outlet</Td>
                <Td className="text-xs text-slate-400">Dibayarkan outlet ke perusahaan</Td>
                <Td className="text-right">({currency.format(Number(royaltyRow.amount))})</Td>
              </Tr>
            )}
            {incentiveCalcs.length === 0 && (
              <EmptyRow colSpan={3}>
                Belum dihitung — jalankan &quot;Hitung Ulang Bulan Ini&quot; di Laporan Insentif untuk periode ini.
              </EmptyRow>
            )}
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td colSpan={2}>TOTAL INSENTIF (Pramu + Pengelola + alokasi Officer/Head Sales, di luar Royalty)</Td>
              <Td className="text-right">{currency.format(totalInsentif)}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      {/* g. Inventory Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>g. Inventory Sheet</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th></Th>
              <Th className="text-right">Quantity</Th>
              <Th className="text-right">Nominal</Th>
            </tr>
          </Thead>
          <tbody>
            <Tr>
              <Td className="font-medium text-slate-900">Saldo Awal</Td>
              <Td className="text-right">{saldoAwalQty}</Td>
              <Td className="text-right">{currency.format(saldoAwalNominal)}</Td>
            </Tr>
            <Tr>
              <Td>Saldo Masuk (Beli)</Td>
              <Td className="text-right">{masukQty}</Td>
              <Td className="text-right">{currency.format(masukNominal)}</Td>
            </Tr>
            <Tr>
              <Td>Saldo Keluar (Dipakai + Rusak + Adjustment)</Td>
              <Td className="text-right">({keluarQty})</Td>
              <Td className="text-right">({currency.format(keluarNominal)})</Td>
            </Tr>
            <Tr className="bg-gold-50 font-bold text-brand-900">
              <Td>Saldo Akhir</Td>
              <Td className="text-right">{saldoAkhirQty}</Td>
              <Td className="text-right">{currency.format(saldoAkhirNominal)}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      {/* h. Report Sheet */}
      <Card>
        <CardHeader>
          <CardTitle>h. Report Sheet — Ringkasan untuk Investor</CardTitle>
        </CardHeader>
        <div className="space-y-1 p-5 pt-2 text-sm">
          <div className="flex items-center justify-between border-b border-slate-100 py-2">
            <span className="text-slate-600">Total Omset</span>
            <span className="font-semibold text-brand-900">{currency.format(totalOmset)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 py-2">
            <span className="text-slate-600">(-) Total Purchase</span>
            <span className="font-semibold text-rose-700">({currency.format(totalPurchase)})</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 py-2">
            <span className="text-slate-600">(-) Total Beban Operasional Outlet</span>
            <span className="font-semibold text-rose-700">({currency.format(totalExpenses)})</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 py-2">
            <span className="text-slate-600">(-) Total Adjustment (Rusak/Reject/Selisih)</span>
            <span className="font-semibold text-rose-700">({currency.format(totalAdjustmentNominal)})</span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 py-2">
            <span className="text-slate-600">(-) Total Insentif + Royalty</span>
            <span className="font-semibold text-rose-700">({currency.format(totalInsentif)})</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gold-50 px-3 py-3 font-bold text-brand-900">
            <span>HASIL BERSIH OUTLET (Report Sheet)</span>
            <span>{currency.format(outletNetResult)}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <FileBarChart className="h-3.5 w-3.5" />
            {outlet.name} — {MONTH_NAMES[month - 1]} {year} — {dailyReports.length} hari operasional tercatat.
          </div>
        </div>
      </Card>
    </div>
  );
}
