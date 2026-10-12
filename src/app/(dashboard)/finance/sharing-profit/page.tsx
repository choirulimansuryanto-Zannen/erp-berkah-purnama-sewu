import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings, HandCoins } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { RunCalculationButton } from "@/components/finance/run-calculation-button";
import { AddOutletInvestorShareForm } from "@/components/finance/add-outlet-investor-share-form";
import { InvestorLedgerCellInput } from "@/components/finance/investor-ledger-cell-input";
import { getInvestorPLRekap } from "@/lib/outlet-investor";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Laporan Sharing Profit — two SEPARATE concepts on one page:
// 1. The existing company-wide pool (poolRate% of company Laba Bersih)
//    split across each active Investor by fixed ownership%.
// 2. Outlet-level investor MoU shares + their rolling Profit/Loss ledger
//    (Rekap Akumulasi) — see lib/outlet-investor.ts. Confirmed with the
//    business 2026-10-12 as a distinct arrangement, not an extension of #1.
export default async function SharingProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; rekapYear?: string; rekapMonth?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const sp = await searchParams;
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const rekapYear = sp.rekapYear ? Number(sp.rekapYear) : now.getFullYear();
  // "Semua bulan" = rekapMonth param "0" — shows December's (year-end
  // cumulative) state; a specific month shows that month's own state.
  const rekapMonthParam = sp.rekapMonth ? Number(sp.rekapMonth) : 0;
  const rekapMonth = rekapMonthParam === 0 ? 12 : rekapMonthParam;
  const rekapPeriodLabel = rekapMonthParam === 0 ? `Januari – Desember ${rekapYear}` : `${MONTH_NAMES[rekapMonth - 1]} ${rekapYear}`;

  const [distributions, outlets, investorRows] = await Promise.all([
    prisma.sharingProfitDistribution.findMany({
      where: { year, month },
      include: { investor: true },
      orderBy: { investor: { name: "asc" } },
    }),
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getInvestorPLRekap(rekapYear, rekapMonth),
  ]);

  const labaBersih = Number(distributions[0]?.labaBersih ?? 0);
  const poolRate = Number(distributions[0]?.poolRate ?? 0);
  const poolAmount = Number(distributions[0]?.poolAmount ?? 0);
  const totalDistributed = distributions.reduce((s, d) => s + Number(d.amount), 0);

  const totalShareValue = investorRows.reduce((s, r) => s + r.shareValue, 0);
  const totalAccum = investorRows.reduce((s, r) => s + r.accum, 0);
  const totalTransferShared = investorRows.reduce((s, r) => s + r.transferShared, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Sharing Profit"
        description="Bagi hasil laba bersih ke investor sesuai persentase kepemilikan masing-masing."
        actions={
          <Link href="/admin/investors" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-700 hover:text-accent-800">
            <Settings className="h-3.5 w-3.5" /> Atur Investor & Rate
          </Link>
        }
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label className="text-[11px]">Bulan</Label>
            <Select name="month" defaultValue={String(month)} className="mt-1">
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
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
          <div className="ml-auto">
            <RunCalculationButton endpoint="/api/finance/sharing-profit" year={year} month={month} />
          </div>
        </form>
        <AddOutletInvestorShareForm outlets={outlets} />
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={`Laba Bersih ${MONTH_NAMES[month - 1]} ${year}`} value={currency.format(labaBersih)} tone="brand" />
        <StatCard label="Rate Pool" value={`${percent.format(poolRate)}%`} tone="accent" />
        <StatCard label="Pool Sharing Profit" value={currency.format(poolAmount)} tone="info" icon={<HandCoins className="h-4 w-4" />} />
        <StatCard label="Investor Dibayar" value={String(distributions.length)} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribusi per Investor</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Investor</Th>
              <Th className="text-right">% Kepemilikan</Th>
              <Th className="text-right">Bagian Sharing Profit</Th>
            </tr>
          </Thead>
          <tbody>
            {distributions.map((d) => (
              <Tr key={d.id}>
                <Td className="font-medium text-slate-900">{d.investor.name}</Td>
                <Td className="text-right">{percent.format(Number(d.ownershipSnapshot))}%</Td>
                <Td className="text-right font-semibold">{currency.format(Number(d.amount))}</Td>
              </Tr>
            ))}
            {distributions.length === 0 && (
              <EmptyRow colSpan={3}>Belum dihitung untuk periode ini — klik &quot;Hitung Ulang Bulan Ini&quot; di atas.</EmptyRow>
            )}
            {distributions.length > 0 && (
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td colSpan={2}>TOTAL DIBAGIKAN</Td>
                <Td className="text-right">{currency.format(totalDistributed)}</Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* Rekap Akumulasi Profit & Loss Investor — outlet-level MoU ledger,
          see lib/outlet-investor.ts for the recurrence. Adj./lock-override
          editing (InvestorLedgerCellInput) only applies when a specific
          Bulan is selected, not "Semua bulan" — that view shows the
          year-end cumulative state, which isn't any single month's own
          cell to edit. */}
      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label className="text-[11px]">Tahun</Label>
            <Select name="rekapYear" defaultValue={String(rekapYear)} className="mt-1">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Bulan</Label>
            <Select name="rekapMonth" defaultValue={String(rekapMonthParam)} className="mt-1">
              <option value={0}>Semua bulan</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Terapkan
          </Button>
        </form>
      </Card>

      <Card className="p-0" id="investor-pl-rekap-section">
        <CardHeader>
          <div>
            <CardTitle>Rekap Akumulasi Profit and Loss Investor</CardTitle>
            <p className="text-xs font-bold uppercase tracking-wide text-accent-700">Periode {rekapPeriodLabel}</p>
          </div>
          <ExportExcelButton containerId="investor-pl-rekap-section" filename={`Rekap_PL_Investor_${rekapPeriodLabel.replace(/\s+/g, "_")}.xlsx`} />
        </CardHeader>
        <Table data-sheet-name="Rekap_PL_Investor" wrapperClassName="max-h-[75vh] overflow-auto">
          <Thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <Th>Nama Investor</Th>
              <Th>Outlet</Th>
              <Th className="text-right">Share Value</Th>
              <Th className="text-right">Accum.</Th>
              <Th className="text-right">Adj.</Th>
              <Th className="text-right">Transfer/Shared</Th>
              <Th>Kunci Bulan Ini</Th>
            </tr>
          </Thead>
          <tbody>
            {investorRows.map((r) => (
              <Tr key={r.investorId}>
                <Td className="font-bold text-slate-900 underline decoration-slate-300">{r.investorName}</Td>
                <Td>{r.outletNames.join(" · ")}</Td>
                <Td className="text-right tabular-nums">{currency.format(r.shareValue)}</Td>
                <Td className={`text-right tabular-nums ${r.accumIsOverride ? "font-semibold text-amber-700" : ""}`}>
                  {currency.format(r.accum)}
                  {r.accumIsOverride && <span title="Dikunci manual"> 🔒</span>}
                </Td>
                <Td className="text-right tabular-nums text-slate-400">{r.adj !== 0 ? currency.format(r.adj) : "—"}</Td>
                <Td className={`text-right font-bold tabular-nums ${r.transferSharedIsOverride ? "text-amber-700" : ""}`}>
                  {currency.format(r.transferShared)}
                  {r.transferSharedIsOverride && <span title="Dikunci manual"> 🔒</span>}
                </Td>
                <Td>
                  {rekapMonthParam === 0 ? (
                    <span className="text-[10px] italic text-slate-400">pilih bulan spesifik</span>
                  ) : (
                    <InvestorLedgerCellInput
                      investorId={r.investorId}
                      year={r.year}
                      month={r.month}
                      defaultAdj={r.adj}
                      defaultAccum={r.accum}
                      defaultAccumIsOverride={r.accumIsOverride}
                      defaultTransferShared={r.transferShared}
                      defaultTransferSharedIsOverride={r.transferSharedIsOverride}
                    />
                  )}
                </Td>
              </Tr>
            ))}
            {investorRows.length === 0 && <EmptyRow colSpan={7}>Belum ada investor outlet dengan MoU aktif pada periode ini.</EmptyRow>}
            {investorRows.length > 0 && (
              <Tr className="bg-gold-50 font-bold text-brand-900">
                <Td colSpan={2}>Total</Td>
                <Td className="text-right tabular-nums">{currency.format(totalShareValue)}</Td>
                <Td className="text-right tabular-nums">{currency.format(totalAccum)}</Td>
                <Td>—</Td>
                <Td className="text-right tabular-nums">{currency.format(totalTransferShared)}</Td>
                <Td></Td>
              </Tr>
            )}
          </tbody>
        </Table>
        <p className="px-5 py-3 text-xs text-slate-400">
          <strong>Share Value</strong> = share MoU × laba bersih outlet (dijumlah dari setiap outlet investor tsb). <strong>Accum.</strong> = Share Value −
          Transfer/Shared bulan lalu − Adj.; bulan lalu hanya terakumulasi kalau bulan itu tidak profit. <strong>Transfer/Shared</strong> = hitungan bersih
          dari Accum., dipakai sebagai Saldo Share Profit Investor. Nilai negatif tetap ditampilkan dan tetap diperhitungkan di akumulasi bulan berikutnya.
          Tanda 🔒 berarti Accum./Transfer-Shared bulan itu dikunci manual (tidak memakai hitungan otomatis) — klik &quot;Edit&quot; pada baris investor
          (hanya muncul saat memilih Bulan spesifik, bukan &quot;Semua bulan&quot;) untuk mengunci atau membuka kuncinya.
        </p>
      </Card>
    </div>
  );
}
