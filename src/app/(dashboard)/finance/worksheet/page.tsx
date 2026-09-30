import { Fragment } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getWorksheetSnapshot, isIncomeStatementType } from "@/lib/accounting";
import type { NormalBalance } from "@prisma/client";

const currency = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

type WorksheetRow = {
  code: string;
  name: string;
  tsDebit: number; // Neraca Saldo (sebelum penyesuaian)
  tsCredit: number;
  pyDebit: number; // Penyesuaian
  pyCredit: number;
  nsdDebit: number; // Neraca Saldo Setelah Disesuaikan
  nsdCredit: number;
  lrDebit: number; // Laba Rugi
  lrCredit: number;
  nrDebit: number; // Neraca
  nrCredit: number;
};

function cell(v: number): string {
  return v === 0 ? "" : currency.format(v);
}

/** Places a signed value on whichever side matches the account's own
 * normal balance (its normal side if positive, the opposite side if
 * negative) — the same convention every column-pair in this worksheet
 * uses, so a Debit and Kredit pair always nets back to the original
 * signed value. */
function placeOnSide(value: number, normalBalance: NormalBalance): { debit: number; credit: number } {
  if (value === 0) return { debit: 0, credit: 0 };
  const onNormalSide = value >= 0;
  const debit = normalBalance === "DEBIT" ? (onNormalSide ? value : 0) : onNormalSide ? 0 : -value;
  const credit = normalBalance === "KREDIT" ? (onNormalSide ? value : 0) : onNormalSide ? 0 : -value;
  return { debit, credit };
}

// The classic 10-column Neraca Lajur (worksheet): Neraca Saldo (before any
// Jurnal Penyesuaian) -> Penyesuaian (Jurnal Penyesuaian entries only) ->
// Neraca Saldo Setelah Disesuaikan -> Laba Rugi -> Neraca. The Laba
// Rugi/Neraca columns extend from the ADJUSTED trial balance, not the raw
// one — the whole point of the Penyesuaian column is to fold non-cash
// period-end adjustments (depresiasi, akrual, ...) in before the figures
// are split into income-statement vs balance-sheet accounts.
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
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1; // 1-indexed

  const snapshot = await getWorksheetSnapshot(year, month);

  const rows: WorksheetRow[] = [];
  for (const a of snapshot) {
    if (a.trialBalance === 0 && a.adjustment === 0) continue;

    const ts = placeOnSide(a.trialBalance, a.normalBalance);
    const py = placeOnSide(a.adjustment, a.normalBalance);
    const nsd = placeOnSide(a.adjustedTrialBalance, a.normalBalance);
    const isIncomeStatement = isIncomeStatementType(a.type);
    rows.push({
      code: a.code,
      name: a.name,
      tsDebit: ts.debit,
      tsCredit: ts.credit,
      pyDebit: py.debit,
      pyCredit: py.credit,
      nsdDebit: nsd.debit,
      nsdCredit: nsd.credit,
      lrDebit: isIncomeStatement ? nsd.debit : 0,
      lrCredit: isIncomeStatement ? nsd.credit : 0,
      nrDebit: isIncomeStatement ? 0 : nsd.debit,
      nrCredit: isIncomeStatement ? 0 : nsd.credit,
    });
  }

  const totals = rows.reduce(
    (acc, r) => ({
      tsDebit: acc.tsDebit + r.tsDebit,
      tsCredit: acc.tsCredit + r.tsCredit,
      pyDebit: acc.pyDebit + r.pyDebit,
      pyCredit: acc.pyCredit + r.pyCredit,
      nsdDebit: acc.nsdDebit + r.nsdDebit,
      nsdCredit: acc.nsdCredit + r.nsdCredit,
      lrDebit: acc.lrDebit + r.lrDebit,
      lrCredit: acc.lrCredit + r.lrCredit,
      nrDebit: acc.nrDebit + r.nrDebit,
      nrCredit: acc.nrCredit + r.nrCredit,
    }),
    { tsDebit: 0, tsCredit: 0, pyDebit: 0, pyCredit: 0, nsdDebit: 0, nsdCredit: 0, lrDebit: 0, lrCredit: 0, nrDebit: 0, nrCredit: 0 },
  );

  const netIncome = totals.lrCredit - totals.lrDebit; // positive = laba
  const plugValue = Math.abs(netIncome);
  const trialBalanceOk = Math.abs(totals.tsDebit - totals.tsCredit) < 1;
  // Jurnal Penyesuaian entries are themselves balanced (debit = kredit) two-
  // line entries, so this column-pair should always tie out on its own too
  // — a mismatch here would mean an adjusting entry was posted un-balanced,
  // which postAdjustingEntry() shouldn't allow, so this is a live integrity
  // check, not just decoration.
  const adjustmentOk = Math.abs(totals.pyDebit - totals.pyCredit) < 1;
  const adjustedOk = Math.abs(totals.nsdDebit - totals.nsdCredit) < 1;

  const grandLrDebit = totals.lrDebit + (netIncome >= 0 ? plugValue : 0);
  const grandLrCredit = totals.lrCredit + (netIncome < 0 ? plugValue : 0);
  const grandNrDebit = totals.nrDebit + (netIncome < 0 ? plugValue : 0);
  const grandNrCredit = totals.nrCredit + (netIncome >= 0 ? plugValue : 0);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const COLUMN_GROUPS = [
    { label: "Neraca Saldo", bg: "bg-slate-100", text: "text-brand-900" },
    { label: "Penyesuaian", bg: "bg-violet-50", text: "text-violet-900" },
    { label: "Neraca Saldo Setelah Disesuaikan", bg: "bg-slate-100", text: "text-brand-900" },
    { label: "Laba Rugi", bg: "bg-amber-50", text: "text-amber-900" },
    { label: "Neraca", bg: "bg-sky-50", text: "text-sky-900" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Worksheet (Neraca Lajur)"
        description="Neraca Saldo → Penyesuaian → Neraca Saldo Setelah Disesuaikan → Laba Rugi → Neraca — cara paling cepat memastikan tidak ada akun atau jurnal penyesuaian yang terlewat."
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
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${trialBalanceOk ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
              {trialBalanceOk ? "✓ Neraca Saldo Seimbang" : "⚠ Neraca Saldo Tidak Seimbang"}
            </span>
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${adjustmentOk ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
              {adjustmentOk ? "✓ Penyesuaian Seimbang" : "⚠ Penyesuaian Tidak Seimbang"}
            </span>
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${adjustedOk ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
              {adjustedOk ? "✓ Setelah Disesuaikan Seimbang" : "⚠ Setelah Disesuaikan Tidak Seimbang"}
            </span>
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <div className="sticky top-16 z-30 flex h-11 items-center rounded-t-xl bg-brand-950 px-5">
          <p className="text-sm font-bold uppercase tracking-wide text-white">
            Worksheet — {MONTH_NAMES[month - 1]} {year}
          </p>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-max border-collapse text-xs">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 top-0 z-20 min-w-[70px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-500">Kode</th>
                <th rowSpan={2} className="sticky left-[70px] top-0 z-20 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-bold uppercase text-slate-500">Nama Akun</th>
                {COLUMN_GROUPS.map((g) => (
                  <th key={g.label} colSpan={2} className={`sticky top-0 z-20 h-9 border-b border-l-2 border-slate-300 ${g.bg} px-2 py-1.5 text-center text-[11px] font-bold uppercase ${g.text}`}>
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr>
                {COLUMN_GROUPS.map((g) => (
                  <Fragment key={g.label}>
                    <th className={`sticky top-9 z-20 h-8 min-w-[110px] border-b border-l-2 border-slate-300 ${g.bg} px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500`}>Debit</th>
                    <th className={`sticky top-9 z-20 h-8 min-w-[110px] border-b border-slate-200 ${g.bg} px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-slate-500`}>Kredit</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-mono text-[10px] text-slate-400">{r.code}</td>
                  <td className="sticky left-[70px] z-10 border-r border-slate-200 bg-white px-3 py-1.5 text-slate-700">{r.name}</td>
                  <td className="border-l-2 border-slate-200 px-2 py-1.5 text-right tabular-nums">{cell(r.tsDebit)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{cell(r.tsCredit)}</td>
                  <td className="border-l-2 border-slate-200 px-2 py-1.5 text-right tabular-nums text-violet-800">{cell(r.pyDebit)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-violet-800">{cell(r.pyCredit)}</td>
                  <td className="border-l-2 border-slate-200 px-2 py-1.5 text-right tabular-nums">{cell(r.nsdDebit)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{cell(r.nsdCredit)}</td>
                  <td className="border-l-2 border-slate-200 px-2 py-1.5 text-right tabular-nums text-amber-800">{cell(r.lrDebit)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-amber-800">{cell(r.lrCredit)}</td>
                  <td className="border-l-2 border-slate-200 px-2 py-1.5 text-right tabular-nums text-sky-800">{cell(r.nrDebit)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-sky-800">{cell(r.nrCredit)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-5 py-10 text-center text-slate-400">
                    Belum ada jurnal pada periode ini.
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-brand-900">
                <td colSpan={2} className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Jumlah</td>
                <td className="border-l-2 border-slate-300 px-2 py-2 text-right tabular-nums">{cell(totals.tsDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cell(totals.tsCredit)}</td>
                <td className="border-l-2 border-slate-300 px-2 py-2 text-right tabular-nums text-violet-900">{cell(totals.pyDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-violet-900">{cell(totals.pyCredit)}</td>
                <td className="border-l-2 border-slate-300 px-2 py-2 text-right tabular-nums">{cell(totals.nsdDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cell(totals.nsdCredit)}</td>
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
                <td className="border-l-2 border-slate-300 px-2 py-2 text-right tabular-nums">-</td>
                <td className="px-2 py-2 text-right tabular-nums">-</td>
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
                <td className="border-l-2 border-white/20 px-2 py-2 text-right tabular-nums">{cell(totals.pyDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cell(totals.pyCredit)}</td>
                <td className="border-l-2 border-white/20 px-2 py-2 text-right tabular-nums">{cell(totals.nsdDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cell(totals.nsdCredit)}</td>
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
