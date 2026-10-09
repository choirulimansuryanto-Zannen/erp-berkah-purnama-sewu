import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { Wallet, TrendingDown, TrendingUp, Banknote, Landmark } from "lucide-react";
import { getCompanyMaterialSchedule } from "@/lib/company-material";
import { CompanyMaterialSkuTable } from "@/components/finance/company-material-sku-table";
import { AdjustingEntryForm } from "@/components/finance/adjusting-entry-form";
import { JournalEntryList, type JournalEntryRow } from "@/components/finance/journal-entry-list";
import { getFixedAssetSchedule } from "@/lib/fixed-asset";
import { CreateFixedAssetForm } from "@/components/finance/create-fixed-asset-form";
import { DisposeFixedAssetButton } from "@/components/finance/dispose-fixed-asset-button";
import { getVendorLedgers } from "@/lib/vendor-ledger";
import { VendorLedgerEntryForm } from "@/components/finance/vendor-ledger-entry-form";
import { getReceivableLedger } from "@/lib/receivable";
import { ReceivableEntryForm } from "@/components/finance/receivable-entry-form";
import { getSalaryRecap } from "@/lib/salary-recap";
import { SalaryRecapTable } from "@/components/finance/salary-recap-table";

const MONTH_LABELS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const vendorDateFormat = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const receivableDateFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type AllParams = {
  pYear: number;
  cmYear: number;
  cmMonth: number;
  jpFrom: string;
  jpTo: string;
  faYear: number;
  arYear: number;
  arMonth: number;
  srYear: number;
  srMonth: number;
};

/** Every other section's current filter value, as hidden inputs — so submitting one section's form doesn't reset the others (a plain GET <form> replaces the whole query string with just its own fields). */
function PreserveParams({ all, except }: { all: AllParams; except: (keyof AllParams)[] }) {
  const entries = Object.entries(all) as [keyof AllParams, string | number][];
  return (
    <>
      {entries
        .filter(([k]) => !except.includes(k))
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
    </>
  );
}

// "Adjustment" — Persediaan, Jurnal Penyesuaian, Fixed Asset, Buku Hutang
// Vendor, dan Buku Piutang merged onto one scrollable sheet (previously 5
// separate FA Company menu items). Each section keeps its own period
// filter, namespaced (pYear/cmYear/cmMonth, jpFrom/jpTo, faYear,
// arYear/arMonth) so they don't collide in the query string, and every
// form carries the other sections' current values as hidden inputs so
// changing one section's period never resets another's.
export default async function AdjustmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    pYear?: string;
    cmYear?: string;
    cmMonth?: string;
    jpFrom?: string;
    jpTo?: string;
    faYear?: string;
    arYear?: string;
    arMonth?: string;
    srYear?: string;
    srMonth?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const sp = await searchParams;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  // ── Persediaan ──────────────────────────────────────────────────────
  const pYear = sp.pYear ? Number(sp.pYear) : now.getFullYear();

  let cmYear: number;
  let cmMonth: number;
  if (sp.cmYear && sp.cmMonth) {
    cmYear = Number(sp.cmYear);
    cmMonth = Number(sp.cmMonth);
  } else {
    const latestCm = await prisma.companyMaterialClosingBalance.findFirst({ orderBy: [{ year: "desc" }, { month: "desc" }] });
    cmYear = latestCm?.year ?? now.getFullYear();
    cmMonth = latestCm?.month ?? now.getMonth() + 1;
  }

  // ── Jurnal Penyesuaian ──────────────────────────────────────────────
  let jpRangeFrom: Date;
  let jpRangeTo: Date;
  if (sp.jpFrom || sp.jpTo) {
    const fallback90 = new Date();
    fallback90.setDate(fallback90.getDate() - 89);
    jpRangeFrom = sp.jpFrom ? new Date(`${sp.jpFrom}T00:00:00`) : fallback90;
    jpRangeTo = sp.jpTo ? new Date(`${sp.jpTo}T00:00:00`) : new Date();
  } else {
    const last90Start = new Date();
    last90Start.setDate(last90Start.getDate() - 89);
    const recentCount = await prisma.journalEntry.count({
      where: { entryType: "JURNAL_PENYESUAIAN", date: { gte: last90Start, lte: now } },
    });
    if (recentCount > 0) {
      jpRangeFrom = last90Start;
      jpRangeTo = now;
    } else {
      const latest = await prisma.journalEntry.findFirst({ where: { entryType: "JURNAL_PENYESUAIAN" }, orderBy: { date: "desc" } });
      if (latest) {
        jpRangeTo = latest.date;
        jpRangeFrom = new Date(latest.date);
        jpRangeFrom.setDate(jpRangeFrom.getDate() - 89);
      } else {
        jpRangeFrom = last90Start;
        jpRangeTo = now;
      }
    }
  }

  // ── Fixed Asset ─────────────────────────────────────────────────────
  const faYear = sp.faYear ? Number(sp.faYear) : now.getFullYear();
  // Cuts off YTD/Accumulated/Economic-Value only — the monthly grid
  // itself always shows all 12 months of faYear regardless (see
  // getFixedAssetSchedule's docblock), so future months are never
  // missing a column.
  const faAsOfMonth = faYear < now.getFullYear() ? 12 : faYear > now.getFullYear() ? 0 : now.getMonth() + 1;
  const faAsOfLabel = faAsOfMonth === 0 ? "belum mulai" : `s/d ${MONTH_LABELS_ID[faAsOfMonth - 1]}`;

  // ── Buku Piutang ────────────────────────────────────────────────────
  const arYear = sp.arYear ? Number(sp.arYear) : 2026;
  const arMonth = sp.arMonth ? Number(sp.arMonth) : 9;

  // ── Rekap Salary ────────────────────────────────────────────────────
  const srYear = sp.srYear ? Number(sp.srYear) : 2026;
  const srMonth = sp.srMonth ? Number(sp.srMonth) : 9;

  const allParams: AllParams = {
    pYear, cmYear, cmMonth, jpFrom: localDateStr(jpRangeFrom), jpTo: localDateStr(jpRangeTo), faYear, arYear, arMonth, srYear, srMonth,
  };

  const [
    companyMaterialSchedule,
    accounts,
    jpEntries,
    fixedAssetSchedule,
    vendorLedgers,
    vendors,
    receivableLedger,
    salaryRecap,
  ] = await Promise.all([
    getCompanyMaterialSchedule(cmYear, cmMonth),
    prisma.chartOfAccount.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } }),
    prisma.journalEntry.findMany({
      where: { entryType: "JURNAL_PENYESUAIAN", date: { gte: jpRangeFrom, lte: jpRangeTo } },
      include: { lines: { include: { account: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    getFixedAssetSchedule(faYear, faAsOfMonth),
    getVendorLedgers(),
    prisma.vendor.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    getReceivableLedger(arYear, arMonth),
    getSalaryRecap(srYear, srMonth),
  ]);

  // ── Jurnal Penyesuaian rows ─────────────────────────────────────────
  const jpRows: JournalEntryRow[] = jpEntries.map((e) => {
    const debitLine = e.lines.find((l) => Number(l.debit) > 0);
    const creditLine = e.lines.find((l) => Number(l.credit) > 0);
    const amount = e.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    return {
      id: e.id,
      entryNumber: e.entryNumber,
      date: e.date.toISOString(),
      cashBook: e.cashBook,
      entryType: e.entryType,
      description: e.description,
      reference: e.reference,
      status: e.status,
      outletName: null,
      amount,
      cashLine: debitLine ? `${debitLine.account.code} ${debitLine.account.name}` : "-",
      contraLine: creditLine ? `${creditLine.account.code} ${creditLine.account.name}` : "-",
    };
  });
  const jpActiveCount = jpEntries.filter((e) => e.status === "POSTED").length;

  // ── Fixed Asset ─────────────────────────────────────────────────────
  const { groups: faGroups, grandTotal: faGrandTotal, monthCount: faMonthCount } = fixedAssetSchedule;
  const faMonthLabels = MONTH_LABELS_ID.slice(0, faMonthCount);

  // ── Vendor Payable ──────────────────────────────────────────────────
  const vpGrandSaldo = vendorLedgers.reduce((s, l) => s + l.saldoAkhir, 0);
  const vpGrandHutang = vendorLedgers.reduce((s, l) => s + l.totalHutang, 0);
  const vpGrandBayar = vendorLedgers.reduce((s, l) => s + l.totalBayar, 0);

  // ── Buku Piutang ────────────────────────────────────────────────────
  const { detailRows: arDetailRows, groupSummary: arGroupSummary, total: arTotal } = receivableLedger;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Adjustment"
        description="Fixed Asset, Rekap Salary, Buku Hutang Vendor, Buku Piutang, Persediaan, dan Jurnal Penyesuaian — satu sheet, scroll untuk berpindah antar bagian."
      />

      {/* Quick nav — jumps are a shortcut, every section is still reachable by scrolling */}
      <nav className="sticky top-16 z-40 flex flex-wrap gap-2 rounded-xl border border-slate-200/70 bg-white/95 p-3 text-xs font-semibold shadow-[var(--shadow-card)] backdrop-blur">
        <a href="#adj-fixed-asset" className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-gold-100">
          Fixed Asset
        </a>
        <a href="#adj-salary-recap" className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-gold-100">
          Rekap Salary
        </a>
        <a href="#adj-vendor-payable" className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-gold-100">
          Buku Hutang Vendor
        </a>
        <a href="#adj-receivable" className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-gold-100">
          Buku Piutang
        </a>
        <a href="#adj-persediaan" className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-gold-100">
          Persediaan
        </a>
        <a href="#adj-jurnal-penyesuaian" className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-gold-100">
          Jurnal Penyesuaian
        </a>
      </nav>

      {/* ══════════════════════ FIXED ASSET ══════════════════════ */}
      <section id="adj-fixed-asset" className="scroll-mt-32 space-y-6">
        <h2 className="text-lg font-bold text-brand-900">Fixed Asset</h2>
        <p className="-mt-4 text-xs text-slate-500">
          Daftar aset tetap per unit — nilai perolehan, dasar penyusutan (PT), penyusutan bulanan, akumulasi penyusutan, dan nilai buku (Economic Value).
          Belum terhubung ke jurnal — register pelacakan per aset, terpisah dari posting Jurnal Penyesuaian.
        </p>

        <Card>
          <form className="flex flex-wrap items-end gap-3 p-5">
            <div>
              <Label className="text-[11px]">Tahun</Label>
              <Select name="faYear" defaultValue={String(faYear)} className="mt-1">
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <PreserveParams all={allParams} except={["faYear"]} />
            <Button type="submit" variant="secondary">
              Tampilkan
            </Button>
          </form>
        </Card>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Nilai Perolehan" value={currency.format(faGrandTotal.acquisitionAmount)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
          <StatCard label="Dasar Penyusutan (PT)" value={currency.format(faGrandTotal.depreciableBase)} tone="neutral" icon={<Landmark className="h-4 w-4" />} />
          <StatCard
            label="Akumulasi Penyusutan"
            value={currency.format(faGrandTotal.accumulatedDepreciation)}
            tone="warning"
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <StatCard label="Economic Value (Nilai Buku)" value={currency.format(faGrandTotal.economicValue)} tone="success" icon={<Wallet className="h-4 w-4" />} />
        </div>

        <CreateFixedAssetForm />

        <p className="text-[11px] text-slate-400">
          Jadwal penyusutan 12 bulan penuh ({faYear}) selalu tampil, termasuk bulan yang belum terjadi — kolom bertanda <span className="italic">*</span> adalah proyeksi, dihitung otomatis dari jadwal penyusutan garis lurus.
        </p>

        <Card className="p-0" id="fixed-asset-section">
          <CardHeader className="sticky top-32 z-30 h-14 bg-white">
            <CardTitle>Daftar Aset Tetap — {faYear}</CardTitle>
            <ExportExcelButton containerId="fixed-asset-section" filename={`Fixed_Asset_${faYear}.xlsx`} />
          </CardHeader>

          <div className="max-h-[75vh] overflow-auto" data-sheet-name="Fixed Asset">
            <table className="w-full min-w-[1600px] border-collapse text-xs">
              <thead className="sticky top-0 z-20">
                  <tr className="bg-brand-950 text-white">
                    <th rowSpan={2} className="sticky will-change-transform left-0 z-30 border-r border-brand-900 bg-brand-950 px-2 py-2 text-left">
                      No
                    </th>
                    <th rowSpan={2} className="sticky will-change-transform left-8 z-30 min-w-[220px] border-r border-brand-900 bg-brand-950 px-3 py-2 text-left">
                      Asset Description
                    </th>
                    <th rowSpan={2} className="min-w-[130px] border-r border-brand-900 px-3 py-2 text-right">
                      Acquisition Amount
                    </th>
                    <th rowSpan={2} className="min-w-[130px] border-r border-brand-900 px-3 py-2 text-right">
                      PT
                    </th>
                    <th rowSpan={2} className="min-w-[120px] border-r border-brand-900 bg-gold-600 px-3 py-2 text-right text-brand-950">
                      {faYear} YTD
                      <br />
                      <span className="text-[10px] font-normal normal-case">({faAsOfLabel})</span>
                    </th>
                    <th colSpan={faMonthCount} className="border-r border-brand-900 bg-gold-600 px-3 py-2 text-center text-brand-950">
                      {faYear} — Jadwal Penyusutan Bulanan (12 bulan penuh)
                    </th>
                    <th rowSpan={2} className="min-w-[120px] border-r border-brand-900 bg-gold-600 px-3 py-2 text-right text-brand-950">
                      {faYear} YTD
                      <br />
                      <span className="text-[10px] font-normal normal-case">({faAsOfLabel})</span>
                    </th>
                    <th rowSpan={2} className="min-w-[140px] border-r border-brand-900 px-3 py-2 text-right">
                      Accum Depreciation Expense
                      <br />
                      <span className="text-[10px] font-normal normal-case text-slate-300">({faAsOfLabel})</span>
                    </th>
                    <th rowSpan={2} className="min-w-[130px] border-r border-brand-900 px-3 py-2 text-right">
                      Economic Value
                      <br />
                      <span className="text-[10px] font-normal normal-case text-slate-300">({faAsOfLabel})</span>
                    </th>
                    <th rowSpan={2} className="min-w-[140px] px-3 py-2 text-left">
                      Remark
                    </th>
                  </tr>
                  <tr className="bg-gold-500 text-brand-950">
                    {faMonthLabels.map((m, i) => (
                      <th
                        key={m}
                        className={`border-r px-2 py-1.5 text-right font-semibold ${i + 1 > faAsOfMonth ? "border-gold-600 bg-gold-400/60 italic text-brand-900/60" : "border-gold-600"} ${i + 1 === faAsOfMonth + 1 ? "border-l-2 border-l-brand-900" : ""}`}
                        title={i + 1 > faAsOfMonth ? "Proyeksi — belum terjadi" : undefined}
                      >
                        {m}
                        {i + 1 > faAsOfMonth && <span className="ml-0.5">*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {faGroups.map((g) => (
                    <FixedAssetGroupRows key={g.category} group={g} monthCount={faMonthCount} asOfMonth={faAsOfMonth} />
                  ))}
                  {faGroups.length === 0 && (
                    <tr>
                      <td colSpan={faMonthCount + 9} className="px-3 py-6 text-center text-slate-400">
                        Belum ada data aset tetap.
                      </td>
                    </tr>
                  )}
                </tbody>
                {faGroups.length > 0 && (
                  <tfoot>
                    <tr className="bg-brand-900 font-bold text-white">
                      <td colSpan={2} className="sticky will-change-transform left-0 z-10 bg-brand-900 px-3 py-2">
                        TOTAL
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency.format(faGrandTotal.acquisitionAmount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency.format(faGrandTotal.depreciableBase)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency.format(faGrandTotal.yearToDateTotal)}</td>
                      {faGrandTotal.months.map((v, i) => (
                        <td key={i} className={`px-2 py-2 text-right tabular-nums ${i + 1 > faAsOfMonth ? "italic text-white/60" : ""}`}>
                          {currency.format(v)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums">{currency.format(faGrandTotal.yearToDateTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency.format(faGrandTotal.accumulatedDepreciation)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency.format(faGrandTotal.economicValue)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
            </table>
          </div>
        </Card>
      </section>

      {/* ══════════════════════ REKAP SALARY ══════════════════════ */}
      <section id="adj-salary-recap" className="scroll-mt-32 space-y-6 border-t border-slate-200 pt-8">
        <h2 className="text-lg font-bold text-brand-900">Rekap Salary</h2>
        <p className="-mt-4 text-xs text-slate-500">Rekap penggajian bulanan per departemen — Total Terima (NET) dikurangi/ditambah setiap komponen, TOTAL (aktual) adalah penjumlahan seluruh baris.</p>

        <Card>
          <form className="flex flex-wrap items-end gap-3 p-5">
            <div>
              <Label className="text-[11px]">Bulan</Label>
              <Select name="srMonth" defaultValue={String(srMonth)} className="mt-1">
                {MONTH_LABELS_ID.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Tahun</Label>
              <Select name="srYear" defaultValue={String(srYear)} className="mt-1">
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <PreserveParams all={allParams} except={["srYear", "srMonth"]} />
            <Button type="submit" variant="secondary">
              Tampilkan
            </Button>
          </form>
        </Card>

        <Card className="p-0" id="salary-recap-section">
          <CardHeader className="sticky top-32 z-30 h-14 bg-white">
            <CardTitle>
              Rekap Salary — {MONTH_LABELS_ID[srMonth - 1]} {srYear}
            </CardTitle>
            <ExportExcelButton containerId="salary-recap-section" filename={`Rekap_Salary_${MONTH_LABELS_ID[srMonth - 1]}_${srYear}.xlsx`} />
          </CardHeader>
          <div className="overflow-x-auto" data-sheet-name="Rekap Salary">
            <SalaryRecapTable columns={salaryRecap.columns} rowTotals={salaryRecap.rowTotals} grandTotal={salaryRecap.grandTotal} year={srYear} month={srMonth} />
          </div>
        </Card>
      </section>

      {/* ══════════════════ BUKU HUTANG VENDOR ══════════════════ */}
      <section id="adj-vendor-payable" className="scroll-mt-32 space-y-6 border-t border-slate-200 pt-8">
        <h2 className="text-lg font-bold text-brand-900">Buku Hutang Vendor</h2>
        <p className="-mt-4 text-xs text-slate-500">
          Kartu hutang per vendor — Hutang (bertambah) / Bayar (berkurang), dengan saldo berjalan. Kelola daftar vendor di menu Admin → Vendor.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Hutang Tercatat" value={currency.format(vpGrandHutang)} tone="warning" icon={<Wallet className="h-4 w-4" />} />
          <StatCard label="Total Dibayar" value={currency.format(vpGrandBayar)} tone="success" icon={<TrendingDown className="h-4 w-4" />} />
          <StatCard label="Saldo Hutang (seluruh vendor)" value={currency.format(vpGrandSaldo)} tone="brand" icon={<Banknote className="h-4 w-4" />} />
        </div>

        <VendorLedgerEntryForm vendors={vendors} />

        <div id="vendor-payable-section" className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {vendorLedgers.map((l) => (
            <Card key={l.id} className="p-0">
              <CardHeader className="h-12">
                <CardTitle className="text-sm">{l.name}</CardTitle>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${l.saldoAkhir > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {currency.format(l.saldoAkhir)}
                </span>
              </CardHeader>
              <div className="max-h-[320px] overflow-y-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-500">Tanggal</th>
                      <th className="border-b border-slate-200 px-2 py-1.5 text-right font-semibold text-slate-500">Debet</th>
                      <th className="border-b border-slate-200 px-2 py-1.5 text-right font-semibold text-slate-500">Kredit</th>
                      <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-500">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.rows.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="px-2 py-1.5 tabular-nums text-slate-600">{vendorDateFormat.format(r.date)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.debet > 0 ? currency.format(r.debet) : "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.kredit > 0 ? currency.format(r.kredit) : "-"}</td>
                        <td className="px-2 py-1.5 text-slate-500">{r.remarks ?? ""}</td>
                      </tr>
                    ))}
                    {l.rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-center text-slate-400">
                          Belum ada entri.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-brand-900">
                      <td className="px-2 py-1.5">Saldo</td>
                      <td colSpan={3} className="px-2 py-1.5 text-right">
                        {currency.format(l.saldoAkhir)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ))}
          {vendorLedgers.length === 0 && (
            <Card className="p-6 text-center text-sm text-slate-400 lg:col-span-2 xl:col-span-3">
              Belum ada vendor — tambahkan di menu Admin → Vendor.
            </Card>
          )}
        </div>
        <div className="flex justify-end">
          <ExportExcelButton containerId="vendor-payable-section" filename="Buku_Hutang_Vendor.xlsx" />
        </div>
      </section>

      {/* ══════════════════════ BUKU PIUTANG ══════════════════════ */}
      <section id="adj-receivable" className="scroll-mt-32 space-y-6 border-t border-slate-200 pt-8">
        <h2 className="text-lg font-bold text-brand-900">Buku Pencatatan Piutang</h2>
        <p className="-mt-4 text-xs text-slate-500">
          Historical Account Receivable — rincian piutang per transaksi dan summary saldo per grup (Outlet/Mitra/Sayur/Kobar/Mangkacau/Tortilla/Mie Steak).
        </p>

        <Card>
          <form className="flex flex-wrap items-end gap-3 p-5">
            <div>
              <Label className="text-[11px]">Bulan</Label>
              <Select name="arMonth" defaultValue={String(arMonth)} className="mt-1">
                {MONTH_LABELS_ID.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Tahun</Label>
              <Select name="arYear" defaultValue={String(arYear)} className="mt-1">
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <PreserveParams all={allParams} except={["arYear", "arMonth"]} />
            <Button type="submit" variant="secondary">
              Tampilkan
            </Button>
          </form>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard label="Saldo Bulan Lalu" value={currency.format(arTotal.saldoBulanLalu)} tone="neutral" icon={<Wallet className="h-4 w-4" />} />
          <StatCard label="Penambahan Piutang" value={currency.format(arTotal.penambahan)} tone="warning" icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Pembayaran Piutang" value={currency.format(arTotal.pembayaran)} tone="success" icon={<TrendingDown className="h-4 w-4" />} />
          <StatCard label="Saldo Bulan Ini" value={currency.format(arTotal.saldoBulanIni)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        </div>

        <ReceivableEntryForm />

        <Card className="p-0" id="receivable-detail-section">
          <CardHeader className="sticky top-32 z-30 h-14 bg-white">
            <CardTitle>
              Rincian Piutang — {MONTH_LABELS_ID[arMonth - 1]} {arYear} ({arDetailRows.length})
            </CardTitle>
            <ExportExcelButton containerId="receivable-detail-section" filename={`Piutang_${MONTH_LABELS_ID[arMonth - 1]}_${arYear}.xlsx`} />
          </CardHeader>
          <div className="max-h-[70vh] overflow-auto" data-sheet-name="Piutang">
            <table className="w-full min-w-[1100px] border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-slate-50">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-2 text-left font-bold uppercase text-slate-500">Date</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-left font-bold uppercase text-slate-500">Mitra Code</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-left font-bold uppercase text-slate-500">Mitra Name</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-left font-bold uppercase text-slate-500">No. Faktur</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left font-bold uppercase text-slate-500">Description</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-right font-bold uppercase text-slate-500">Debt</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-right font-bold uppercase text-slate-500">Credit</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left font-bold uppercase text-slate-500">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {arDetailRows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                      <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">{receivableDateFormat.format(r.date)}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.mitraCode}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-900">{r.mitraName}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.noFaktur ?? "-"}</td>
                      <td className="px-3 py-1.5">{r.description}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.debt > 0 ? currency.format(r.debt) : "-"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.credit > 0 ? currency.format(r.credit) : "-"}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.remarks ?? ""}</td>
                    </tr>
                  ))}
                  {arDetailRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                        Belum ada entri piutang pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-0">
          <CardHeader>
            <CardTitle>
              Summary Saldo Piutang per Grup — {MONTH_LABELS_ID[arMonth - 1]} {arYear}
            </CardTitle>
          </CardHeader>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="border-b border-slate-200 px-4 py-2 text-left">Grup</th>
                <th className="border-b border-slate-200 px-4 py-2 text-right">Saldo Bulan Lalu</th>
                <th className="border-b border-slate-200 px-4 py-2 text-right">Penambahan Piutang</th>
                <th className="border-b border-slate-200 px-4 py-2 text-right">Pembayaran Piutang</th>
                <th className="border-b border-slate-200 px-4 py-2 text-right">Saldo Bulan Ini</th>
              </tr>
            </thead>
            <tbody>
              {arGroupSummary.map((g) => (
                <tr key={g.group} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium text-slate-900">{g.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{currency.format(g.saldoBulanLalu)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{g.penambahan > 0 ? currency.format(g.penambahan) : "-"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{g.pembayaran > 0 ? `(${currency.format(g.pembayaran)})` : "-"}</td>
                  <td className="bg-gold-50/40 px-4 py-2 text-right font-semibold tabular-nums text-brand-900">{currency.format(g.saldoBulanIni)}</td>
                </tr>
              ))}
              <tr className="bg-brand-900 font-bold text-white">
                <td className="px-4 py-2">TOTAL</td>
                <td className="px-4 py-2 text-right tabular-nums">{currency.format(arTotal.saldoBulanLalu)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{currency.format(arTotal.penambahan)}</td>
                <td className="px-4 py-2 text-right tabular-nums">({currency.format(arTotal.pembayaran)})</td>
                <td className="px-4 py-2 text-right tabular-nums">{currency.format(arTotal.saldoBulanIni)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </section>

      {/* ══════════════════════ PERSEDIAAN ══════════════════════ */}
      <section id="adj-persediaan" className="scroll-mt-32 space-y-6 border-t border-slate-200 pt-8">
        <h2 className="text-lg font-bold text-brand-900">Persediaan</h2>

        <Card>
          <p className="px-5 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pilih Periode — berlaku untuk Tabel Persediaan &amp; Tabel SKU di bawah
          </p>
          <form className="flex flex-wrap items-end gap-3 p-5 pt-3">
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
            <PreserveParams all={allParams} except={["cmYear", "cmMonth"]} />
            <Button type="submit" variant="secondary">
              Tampilkan
            </Button>
          </form>
        </Card>

        <Card className="p-0" id="company-material-sku-section">
          <CardHeader className="sticky top-32 z-30 h-14 bg-white">
            <div className="flex items-center gap-3">
              <CardTitle>
                Tabel SKU — {MONTH_LABELS_ID[cmMonth - 1]} {cmYear}
              </CardTitle>
              <a href="#adj-persediaan" className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-gold-100">
                Ubah Periode
              </a>
            </div>
            <ExportExcelButton containerId="company-material-sku-section" filename={`Tabel_SKU_${MONTH_LABELS_ID[cmMonth - 1]}_${cmYear}.xlsx`} />
          </CardHeader>
          <div className="max-h-[75vh] overflow-auto" data-sheet-name="Tabel SKU">
            <CompanyMaterialSkuTable groups={companyMaterialSchedule.groups} year={cmYear} month={cmMonth} />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-0">
            <div className="rounded-t-xl bg-brand-950 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wide text-white">Account Summary — Saldo</p>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="h-[46px] bg-slate-100 text-[11px] font-bold uppercase text-slate-500">
                  <th className="min-w-[150px] px-3 py-2 text-left align-middle">Account Name</th>
                  <th className="bg-rose-100 px-3 py-2 text-right align-middle">Total Saldo Awal</th>
                  <th className="bg-rose-200 px-3 py-2 text-right align-middle">Total Saldo Akhir</th>
                </tr>
              </thead>
              <tbody>
                {companyMaterialSchedule.accountSummary.map((a) => (
                  <tr
                    key={a.label}
                    className={a.label === "TOTAL" ? "bg-brand-900 font-bold text-white" : a.label.startsWith("TOTAL") ? "bg-slate-100 font-semibold text-brand-900" : "border-b border-slate-100 odd:bg-white even:bg-slate-50/60"}
                  >
                    <td className="whitespace-nowrap px-3 py-1.5">{a.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(a.totalSaldoAwalNominal)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(a.totalNilaiAkhir)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-0">
            <div className="rounded-t-xl bg-brand-950 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wide text-white">Account Summary — Pecah Invoice</p>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="h-[46px] bg-slate-100 text-[11px] font-bold uppercase text-slate-500">
                  <th className="min-w-[150px] px-3 py-2 text-left align-middle">Account Name</th>
                  <th className="bg-gold-100 px-3 py-2 text-right align-middle">Faktur Awal Bulan Outlet</th>
                  <th className="bg-slate-200 px-3 py-2 text-right align-middle">Adjustment Inventory</th>
                  <th className="bg-sky-100 px-3 py-2 text-right align-middle">Total Bahan Baku</th>
                </tr>
              </thead>
              <tbody>
                {companyMaterialSchedule.accountSummary.map((a) => (
                  <tr
                    key={a.label}
                    className={a.label === "TOTAL" ? "bg-brand-900 font-bold text-white" : a.label.startsWith("TOTAL") ? "bg-slate-100 font-semibold text-brand-900" : "border-b border-slate-100 odd:bg-white even:bg-slate-50/60"}
                  >
                    <td className="whitespace-nowrap px-3 py-1.5">{a.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(a.totalFakturNominal)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(a.totalAdjustmentInventoryNominal)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(a.totalNominal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </section>

      {/* ══════════════════ JURNAL PENYESUAIAN ══════════════════ */}
      <section id="adj-jurnal-penyesuaian" className="scroll-mt-32 space-y-6 border-t border-slate-200 pt-8">
        <h2 className="text-lg font-bold text-brand-900">Jurnal Penyesuaian</h2>
        <p className="-mt-4 text-xs text-slate-500">
          Entri non-kas akhir periode — depresiasi, akrual, amortisasi dibayar-di-muka, koreksi. Tidak menyentuh akun buku kas manapun.
        </p>

        <Card>
          <form className="flex flex-wrap items-end gap-2 p-5">
            <div>
              <Label htmlFor="jpFrom">Dari Tanggal</Label>
              <Input id="jpFrom" type="date" name="jpFrom" defaultValue={allParams.jpFrom} max={todayStr()} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="jpTo">Sampai Tanggal</Label>
              <Input id="jpTo" type="date" name="jpTo" defaultValue={allParams.jpTo} max={todayStr()} className="mt-1" />
            </div>
            <PreserveParams all={allParams} except={["jpFrom", "jpTo"]} />
            <Button type="submit" variant="secondary">
              Tampilkan
            </Button>
          </form>
        </Card>

        <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Jurnal Penyesuaian Aktif (periode ini)</p>
          <p className="mt-1 text-2xl font-bold text-brand-900">{jpActiveCount}</p>
        </div>

        <AdjustingEntryForm accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, cashBook: a.cashBook }))} />

        <Card className="p-0">
          <CardHeader className="sticky top-32 z-30 h-14 bg-white">
            <CardTitle>Riwayat Jurnal Penyesuaian ({jpRows.length})</CardTitle>
          </CardHeader>
          <JournalEntryList entries={jpRows} />
        </Card>
      </section>
    </div>
  );
}

function FixedAssetGroupRows({
  group,
  monthCount,
  asOfMonth,
}: {
  group: Awaited<ReturnType<typeof getFixedAssetSchedule>>["groups"][number];
  monthCount: number;
  asOfMonth: number;
}) {
  const projectedCell = "bg-slate-50/60 italic text-slate-400";
  return (
    <>
      <tr className="bg-slate-100">
        <td colSpan={monthCount + 9} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-900">
          {group.label}
        </td>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.id} className="group border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-gold-50/40">
          <td className="sticky will-change-transform left-0 z-10 bg-white px-2 py-1.5 tabular-nums text-slate-400 group-hover:bg-gold-50">{r.no ?? "-"}</td>
          <td className="sticky will-change-transform left-8 z-10 bg-white px-3 py-1.5 font-medium text-slate-900 group-hover:bg-gold-50">{r.description}</td>
          <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(r.acquisitionAmount)}</td>
          <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(r.depreciableBase)}</td>
          <td className="px-3 py-1.5 text-right tabular-nums">{r.yearToDateTotal > 0 ? currency.format(r.yearToDateTotal) : "-"}</td>
          {Array.from({ length: monthCount }, (_, i) => r.months[i] ?? 0).map((v, i) => (
            <td key={i} className={`px-2 py-1.5 text-right tabular-nums ${i + 1 > asOfMonth ? projectedCell : ""}`}>
              {v > 0 ? currency.format(v) : "-"}
            </td>
          ))}
          <td className="px-3 py-1.5 text-right tabular-nums">{r.yearToDateTotal > 0 ? currency.format(r.yearToDateTotal) : "-"}</td>
          <td className="bg-gold-50/40 px-3 py-1.5 text-right font-semibold tabular-nums text-brand-900">{currency.format(r.accumulatedDepreciation)}</td>
          <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(r.economicValue)}</td>
          <td className="px-3 py-1.5 text-slate-500">
            <div className="flex items-center justify-between gap-2">
              <span>{r.fullyDepreciated ? "Fully depreciated" : r.remark ?? ""}</span>
              <DisposeFixedAssetButton id={r.id} description={r.description} />
            </div>
          </td>
        </tr>
      ))}
      <tr className="bg-gold-50 font-bold text-brand-900">
        <td colSpan={2} className="sticky will-change-transform left-0 z-10 bg-gold-50 px-3 py-1.5">
          TOTAL {group.label}
        </td>
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.acquisitionAmount)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.depreciableBase)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.yearToDateTotal)}</td>
        {Array.from({ length: monthCount }, (_, i) => group.totals.months[i] ?? 0).map((v, i) => (
          <td key={i} className={`px-2 py-1.5 text-right tabular-nums ${i + 1 > asOfMonth ? "italic text-brand-900/50" : ""}`}>
            {currency.format(v)}
          </td>
        ))}
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.yearToDateTotal)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.accumulatedDepreciation)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{currency.format(group.totals.economicValue)}</td>
        <td />
      </tr>
    </>
  );
}
