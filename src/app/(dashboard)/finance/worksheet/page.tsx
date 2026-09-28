import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMonthlyAccountMatrix, isIncomeStatementType } from "@/lib/accounting";

const currency = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

type WorksheetRow = {
  code: string;
  name: string;
  tsDebit: number; // Neraca Saldo
  tsCredit: number;
  lrDebit: number; // Laba Rugi
  lrCredit: number;
  nrDebit: number; // Neraca
  nrCredit: number;
};

function cell(v: number): string {
  return v === 0 ? "" : currency.format(v);
}

// The classic 6-column Neraca Lajur (worksheet): every account's own period
// balance (Neraca Saldo) is placed on its normal side, then carried
// unchanged into EITHER the Laba Rugi pair or the Neraca pair depending on
// account type — the two totals in each pair only balance once the
// Laba/Rugi "plug" line (the same figure the Laba Rugi report itself would
// show for this period) is added, which is the worksheet's whole point:
// it's a hand-checkable proof that closing figures are internally
// consistent before they're presented as separate reports.
export default async function WorksheetPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam, month: monthParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) - 1 : now.getMonth(); // 0-indexed

  const matrix = await getMonthlyAccountMatrix(year);

  // Books are never formally closed month-to-month (see the "belum ditutup"
  // equity row on the Neraca report), so the trial balance here has to be
  // YTD-cumulative through the selected month for EVERY account — P&L
  // accounts included. Using each P&L account's raw single-month movement
  // instead would leave the Neraca Saldo unbalanced from the second active
  // month onward, since the Neraca side already carries forward every prior
  // month's retained profit while the Laba Rugi side would only show the
  // current month's isolated activity. `a.cumulative[month]` already IS the
  // YTD sum for P&L types (their `opening` is always 0), so this is a single
  // consistent basis for every row.
  const rows: WorksheetRow[] = [];
  for (const a of matrix) {
    const periodValue = a.cumulative[month];
    if (periodValue === 0) continue;

    const onNormalSide = periodValue >= 0;
    const tsDebit = a.normalBalance === "DEBIT" ? (onNormalSide ? periodValue : 0) : onNormalSide ? 0 : -periodValue;
    const tsCredit = a.normalBalance === "KREDIT" ? (onNormalSide ? periodValue : 0) : onNormalSide ? 0 : -periodValue;

    const isIncomeStatement = isIncomeStatementType(a.type);
    rows.push({
      code: a.code,
      name: a.name,
      tsDebit,
      tsCredit,
      lrDebit: isIncomeStatement ? tsDebit : 0,
      lrCredit: isIncomeStatement ? tsCredit : 0,
      nrDebit: isIncomeStatement ? 0 : tsDebit,
      nrCredit: isIncomeStatement ? 0 : tsCredit,
    });
  }

  const totals = rows.reduce(
    (acc, r) => ({
      tsDebit: acc.tsDebit + r.tsDebit,
      tsCredit: acc.tsCredit + r.tsCredit,
      lrDebit: acc.lrDebit + r.lrDebit,
      lrCredit: acc.lrCredit + r.lrCredit,
      nrDebit: acc.nrDebit + r.nrDebit,
      nrCredit: acc.nrCredit + r.nrCredit,
    }),
    { tsDebit: 0, tsCredit: 0, lrDebit: 0, lrCredit: 0, nrDebit: 0, nrCredit: 0 },
  );

  const netIncome = totals.lrCredit - totals.lrDebit; // positive = laba
  const plugValue = Math.abs(netIncome);
  const trialBalanceOk = Math.abs(totals.tsDebit - totals.tsCredit) < 1;

  const grandLrDebit = totals.lrDebit + (netIncome >= 0 ? plugValue : 0);
  const grandLrCredit = totals.lrCredit + (netIncome < 0 ? plugValue : 0);
  const grandNrDebit = totals.nrDebit + (netIncome < 0 ? plugValue : 0);
  const grandNrCredit = totals.nrCredit + (netIncome >= 0 ? plugValue : 0);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Worksheet (Neraca Lajur)"
        description="Neraca Saldo → Laba Rugi → Neraca dalam satu tabel, untuk satu periode tutup buku — cara paling cepat memastikan tidak ada akun yang terlewat."
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label className="text-[11px]">Bulan</Label>
            <Select name="month" defaultValue={String(month + 1)} className="mt-1">
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
          <div
            className={`ml-auto rounded-full px-3 py-1.5 text-xs font-bold ${trialBalanceOk ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
          >
            {trialBalanceOk ? "✓ Neraca Saldo Seimbang" : "⚠ Neraca Saldo Tidak Seimbang"}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">
            Worksheet — {MONTH_NAMES[month]} {year}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-xs">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 z-10 min-w-[70px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-500">Kode</th>
                <th rowSpan={2} className="sticky left-[70px] z-10 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-500">Nama Akun</th>
                <th colSpan={2} className="border-b border-l-2 border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-[11px] font-bold uppercase text-brand-900">Neraca Saldo</th>
                <th colSpan={2} className="border-b border-l-2 border-slate-300 bg-amber-50 px-2 py-1.5 text-center text-[11px] font-bold uppercase text-amber-900">Laba Rugi</th>
                <th colSpan={2} className="border-b border-l-2 border-slate-300 bg-sky-50 px-2 py-1.5 text-center text-[11px] font-bold uppercase text-sky-900">Neraca</th>
              </tr>
              <tr>
                <th className="min-w-[110px] border-b border-l-2 border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Debit</th>
                <th className="min-w-[110px] border-b border-slate-200 px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Kredit</th>
                <th className="min-w-[110px] border-b border-l-2 border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Debit</th>
                <th className="min-w-[110px] border-b border-slate-200 px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Kredit</th>
                <th className="min-w-[110px] border-b border-l-2 border-slate-300 px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Debit</th>
                <th className="min-w-[110px] border-b border-slate-200 px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-mono text-[10px] text-slate-400">{r.code}</td>
                  <td className="sticky left-[70px] z-10 border-r border-slate-200 bg-white px-3 py-1.5 text-slate-700">{r.name}</td>
                  <td className="border-l-2 border-slate-200 px-2 py-1.5 text-right tabular-nums">{cell(r.tsDebit)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{cell(r.tsCredit)}</td>
                  <td className="border-l-2 border-slate-200 px-2 py-1.5 text-right tabular-nums text-amber-800">{cell(r.lrDebit)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-amber-800">{cell(r.lrCredit)}</td>
                  <td className="border-l-2 border-slate-200 px-2 py-1.5 text-right tabular-nums text-sky-800">{cell(r.nrDebit)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-sky-800">{cell(r.nrCredit)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    Belum ada jurnal pada periode ini.
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-brand-900">
                <td colSpan={2} className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Jumlah</td>
                <td className="border-l-2 border-slate-300 px-2 py-2 text-right tabular-nums">{cell(totals.tsDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cell(totals.tsCredit)}</td>
                <td className="border-l-2 border-slate-300 px-2 py-2 text-right tabular-nums text-amber-900">{cell(totals.lrDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-amber-900">{cell(totals.lrCredit)}</td>
                <td className="border-l-2 border-slate-300 px-2 py-2 text-right tabular-nums text-sky-900">{cell(totals.nrDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-sky-900">{cell(totals.nrCredit)}</td>
              </tr>
              <tr className="border-t border-slate-200 bg-gold-50 font-bold text-brand-900">
                <td colSpan={2} className="sticky left-0 z-10 bg-gold-50 px-3 py-2">
                  {netIncome >= 0 ? "Laba Bersih" : "Rugi Bersih"} (penyeimbang)
                </td>
                <td className="border-l-2 border-slate-300 px-2 py-2 text-right tabular-nums">-</td>
                <td className="px-2 py-2 text-right tabular-nums">-</td>
                <td className="border-l-2 border-slate-300 px-2 py-2 text-right tabular-nums text-amber-900">{netIncome >= 0 ? cell(plugValue) : ""}</td>
                <td className="px-2 py-2 text-right tabular-nums text-amber-900">{netIncome < 0 ? cell(plugValue) : ""}</td>
                <td className="border-l-2 border-slate-300 px-2 py-2 text-right tabular-nums text-sky-900">{netIncome < 0 ? cell(plugValue) : ""}</td>
                <td className="px-2 py-2 text-right tabular-nums text-sky-900">{netIncome >= 0 ? cell(plugValue) : ""}</td>
              </tr>
              <tr className="border-t-2 border-brand-900 bg-brand-950 font-bold text-white">
                <td colSpan={2} className="sticky left-0 z-10 bg-brand-950 px-3 py-2">Jumlah Akhir</td>
                <td className="border-l-2 border-white/20 px-2 py-2 text-right tabular-nums">{cell(totals.tsDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cell(totals.tsCredit)}</td>
                <td className="border-l-2 border-white/20 px-2 py-2 text-right tabular-nums">{cell(grandLrDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cell(grandLrCredit)}</td>
                <td className="border-l-2 border-white/20 px-2 py-2 text-right tabular-nums">{cell(grandNrDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cell(grandNrCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
