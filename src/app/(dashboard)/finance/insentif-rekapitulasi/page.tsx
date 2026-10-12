import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { ExportExcelButton } from "@/components/ui/export-excel-button";
import { PrintButton } from "@/components/ui/print-button";
import { getInsentiveRekapitulasi } from "@/lib/outlet-report";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const number0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const number2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

type Tab = "outlet" | "pramuniaga" | "diberikan" | "tidak-diberikan";
const TABS: { key: Tab; label: string }[] = [
  { key: "outlet", label: "Per Outlet" },
  { key: "pramuniaga", label: "Per Pramuniaga" },
  { key: "diberikan", label: "Diberikan" },
  { key: "tidak-diberikan", label: "Tidak Diberikan" },
];

// Laporan Rekapitulasi Insentive — company-wide, one month, the same
// JPD+omset-gated pramuniaga bracket incentive the Insentive Sheet
// computes per outlet, in 4 rollup views (format confirmed with the
// business 2026-10-12). See getInsentiveRekapitulasi for what each view
// shows and the ALASAN wording for Tidak Diberikan.
export default async function InsentiveRekapitulasiPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const sp = await searchParams;
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const tab: Tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : "outlet") as Tab;

  const { outletRows, pramuniagaRows, tidakDiberikanRows, groupedByPerson } = await getInsentiveRekapitulasi(year, month);
  const diberikanRows = pramuniagaRows.filter((r) => r.gatePassed);

  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const tabHref = (t: Tab) => `/finance/insentif-rekapitulasi?year=${year}&month=${month}&tab=${t}`;

  // First-row-of-group flags — used so TOTAL/GROUPED TOTAL only prints
  // once per person instead of repeating on every outlet row.
  const seenPersonTotal = new Set<string>();
  const seenPersonGrouped = new Set<string>();
  const totalByPerson = new Map<string, number>();
  for (const r of pramuniagaRows) totalByPerson.set(r.rosterKey, (totalByPerson.get(r.rosterKey) ?? 0) + r.insentive);

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan Rekapitulasi Insentive" description="Insentif Operator per outlet dan per pramuniaga — diberikan hanya saat JPD ≥ 75 dan omset ≥ 80% target." />

      <Card>
        <div className="flex items-start justify-between px-5 pt-5">
          <p className="text-sm font-bold text-slate-700">Filter Bulanan</p>
          <PrintButton />
        </div>
        <form className="flex flex-wrap items-end gap-3 p-5 pt-3">
          <input type="hidden" name="tab" value={tab} />
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
          <Button type="submit" variant="secondary">
            Terapkan
          </Button>
        </form>
        <p className="px-5 pb-4 text-xs text-slate-400">
          Hanya laporan terverifikasi yang masuk rekap. Outlet tanpa sumber perhitungan bulan ini tidak dianggap bernilai nol (outlet tanpa transaksi
          dilewati, bukan ditampilkan sebagai Rp 0).
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? "bg-brand-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "outlet" && (
        <Card className="p-0" id="insentif-rekap-section">
          <CardHeader>
            <CardTitle>PERHITUNGAN · {periodLabel}</CardTitle>
            <ExportExcelButton containerId="insentif-rekap-section" filename={`Perhitungan_Insentive_${periodLabel}.xlsx`} />
          </CardHeader>
          <Table data-sheet-name="Per_Outlet" wrapperClassName="max-h-[75vh] overflow-auto">
            <Thead className="sticky top-0 z-20 bg-slate-50">
              <tr>
                <Th>No.</Th>
                <Th>Outlet</Th>
                <Th>Kode</Th>
                <Th className="text-right">Omset</Th>
                <Th className="text-right">AVG Sales</Th>
                <Th className="text-right">AVG Beef Used</Th>
                <Th className="text-right">Insentive Operator</Th>
                <Th>Wil./Home Base</Th>
                <Th>Paraf</Th>
              </tr>
            </Thead>
            <tbody>
              {outletRows.map((r, idx) => (
                <Tr key={r.outletId}>
                  <Td>{idx + 1}</Td>
                  <Td className="font-bold text-slate-900">{r.outletName}</Td>
                  <Td className="font-mono text-xs text-slate-400">{r.kode}</Td>
                  <Td className="text-right tabular-nums">{number0.format(r.omsetQty)}</Td>
                  <Td className="text-right tabular-nums">{number2.format(r.avgSales)}</Td>
                  <Td className="text-right tabular-nums">{number2.format(r.avgBeefUsed)}</Td>
                  <Td className={`text-right font-semibold tabular-nums ${r.insentiveOperator > 0 ? "text-emerald-700" : ""}`}>{currency.format(r.insentiveOperator)}</Td>
                  <Td>{r.area}</Td>
                  <Td>
                    <span className="inline-block w-24 border-b border-slate-300">&nbsp;</span>
                  </Td>
                </Tr>
              ))}
              {outletRows.length === 0 && <EmptyRow colSpan={9}>Belum ada outlet dengan transaksi terverifikasi bulan ini.</EmptyRow>}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "pramuniaga" && (
        <Card className="p-0" id="insentif-rekap-section">
          <CardHeader>
            <CardTitle>Rekap Insentive Operator · {periodLabel}</CardTitle>
            <ExportExcelButton containerId="insentif-rekap-section" filename={`Rekap_Insentive_Operator_${periodLabel}.xlsx`} />
          </CardHeader>
          <Table data-sheet-name="Per_Pramuniaga" wrapperClassName="max-h-[75vh] overflow-auto">
            <Thead className="sticky top-0 z-20 bg-slate-50">
              <tr>
                <Th>No.</Th>
                <Th>Pramuniaga</Th>
                <Th>Outlet</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Insentive</Th>
                <Th className="text-right">Total</Th>
                <Th>Paraf Operator</Th>
                <Th>Kode</Th>
              </tr>
            </Thead>
            <tbody>
              {(() => {
                let no = 0;
                const lastPerson = new Set<string>();
                return pramuniagaRows.map((r) => {
                  const isFirst = !lastPerson.has(r.rosterKey);
                  lastPerson.add(r.rosterKey);
                  if (isFirst) no += 1;
                  return (
                    <Tr key={`${r.rosterKey}:${r.outletId}`}>
                      <Td>{isFirst ? no : ""}</Td>
                      <Td className={isFirst ? "font-bold text-slate-900" : "text-slate-400"}>{isFirst ? r.pramuniagaName : ""}</Td>
                      <Td>{r.outletName}</Td>
                      <Td className="text-right tabular-nums">{number0.format(r.qty)}</Td>
                      <Td className="text-right tabular-nums">{currency.format(r.insentive)}</Td>
                      <Td className="text-right font-bold tabular-nums">{isFirst ? currency.format(totalByPerson.get(r.rosterKey) ?? 0) : ""}</Td>
                      <Td>{isFirst ? <span className="inline-block w-24 border-b border-slate-300">&nbsp;</span> : null}</Td>
                      <Td className="font-mono text-xs text-slate-400">{r.kode}</Td>
                    </Tr>
                  );
                });
              })()}
              {pramuniagaRows.length === 0 && <EmptyRow colSpan={8}>Belum ada data pramuniaga bulan ini.</EmptyRow>}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "diberikan" && (
        <Card className="p-0" id="insentif-rekap-section">
          <CardHeader>
            <CardTitle>Insentive Diberikan · {periodLabel}</CardTitle>
            <ExportExcelButton containerId="insentif-rekap-section" filename={`Insentive_Diberikan_${periodLabel}.xlsx`} />
          </CardHeader>
          <Table data-sheet-name="Diberikan" wrapperClassName="max-h-[75vh] overflow-auto">
            <Thead className="sticky top-0 z-20 bg-slate-50">
              <tr>
                <Th>No.</Th>
                <Th>Pramuniaga</Th>
                <Th>Outlet</Th>
                <Th>Kode</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Insentive</Th>
                <Th>Periode</Th>
              </tr>
            </Thead>
            <tbody>
              {diberikanRows.map((r, idx) => (
                <Tr key={`${r.rosterKey}:${r.outletId}`}>
                  <Td>{idx + 1}</Td>
                  <Td className="font-medium text-slate-900">{r.pramuniagaName}</Td>
                  <Td>{r.outletName}</Td>
                  <Td className="font-mono text-xs text-slate-400">{r.kode}</Td>
                  <Td className="text-right tabular-nums">{number0.format(r.qty)}</Td>
                  <Td className="text-right font-semibold tabular-nums text-emerald-700">{currency.format(r.insentive)}</Td>
                  <Td>{periodLabel}</Td>
                </Tr>
              ))}
              {diberikanRows.length === 0 && <EmptyRow colSpan={7}>Belum ada insentive yang diberikan bulan ini.</EmptyRow>}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "tidak-diberikan" && (
        <Card className="p-0" id="insentif-rekap-section">
          <CardHeader>
            <CardTitle>Insentive Tidak Diberikan · {periodLabel}</CardTitle>
            <ExportExcelButton containerId="insentif-rekap-section" filename={`Insentive_Tidak_Diberikan_${periodLabel}.xlsx`} />
          </CardHeader>
          <Table data-sheet-name="Tidak_Diberikan" wrapperClassName="max-h-[75vh] overflow-auto">
            <Thead className="sticky top-0 z-20 bg-slate-50">
              <tr>
                <Th>No.</Th>
                <Th>Pramuniaga</Th>
                <Th>Outlet</Th>
                <Th>Kode</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Calculated</Th>
                <Th className="text-right">Grouped Total</Th>
                <Th>Periode</Th>
                <Th>Alasan</Th>
              </tr>
            </Thead>
            <tbody>
              {(() => {
                let no = 0;
                const lastPerson = new Set<string>();
                return tidakDiberikanRows.map((r) => {
                  const isFirst = !lastPerson.has(r.rosterKey);
                  lastPerson.add(r.rosterKey);
                  if (isFirst) no += 1;
                  const grouped = groupedByPerson.get(r.rosterKey) ?? 0;
                  return (
                    <Tr key={`${r.rosterKey}:${r.outletId}`}>
                      <Td>{isFirst ? no : ""}</Td>
                      <Td className={isFirst ? "font-bold text-slate-900" : "text-slate-400"}>{isFirst ? r.pramuniagaName : ""}</Td>
                      <Td>{r.outletName}</Td>
                      <Td className="font-mono text-xs text-slate-400">{r.kode}</Td>
                      <Td className="text-right tabular-nums">{number0.format(r.qty)}</Td>
                      <Td className="text-right font-semibold tabular-nums">{currency.format(r.calculated)}</Td>
                      <Td className="text-right tabular-nums">
                        {isFirst ? (
                          <>
                            <div className="text-slate-400">Raw {currency.format(grouped)}</div>
                            <div className="font-bold text-rose-700">Ditahan {currency.format(grouped)}</div>
                          </>
                        ) : null}
                      </Td>
                      <Td>{periodLabel}</Td>
                      <Td className="max-w-[320px] text-xs text-slate-500">{r.alasan}</Td>
                    </Tr>
                  );
                });
              })()}
              {tidakDiberikanRows.length === 0 && <EmptyRow colSpan={9}>Tidak ada insentive yang ditahan bulan ini — semua outlet lolos gate.</EmptyRow>}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
