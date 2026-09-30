import { cn } from "@/lib/cn";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

export type MonthlyReportRow = {
  code?: string;
  label: string;
  values: number[]; // exactly 12 — Jan..Dec
  style?: "normal" | "subtotal" | "total" | "header";
  indent?: boolean;
  negative?: boolean; // render in parentheses, e.g. deductions
  /** Overrides the table-level `totalMode` for just this row — a table can
   * mix movement rows (want "sum") with a cumulative running-balance row
   * (wants "latest"), e.g. Perubahan Ekuitas's "Ekuitas Akhir" line inside
   * an otherwise all-movement table. */
  totalMode?: "sum" | "average" | "latest";
};

// `negative` marks a row that's always a deduction (shown in parentheses
// regardless of its stored sign, e.g. HPP/Beban rows); otherwise a
// genuinely negative value (a loss month, a rare debit-side revenue
// contra-entry) still renders in parentheses on its own.
function formatCell(v: number, negative?: boolean): string {
  if (v === 0) return "-";
  const text = compact.format(Math.abs(v));
  return negative || v < 0 ? `(${text})` : text;
}

const ROW_STYLE: Record<NonNullable<MonthlyReportRow["style"]>, string> = {
  normal: "text-slate-600",
  subtotal: "bg-slate-50 font-bold text-brand-900",
  total: "bg-gold-400 font-bold text-brand-950",
  header: "bg-brand-950 font-bold text-white",
};

// The Jan-Dec comparison grid every finance report in this module shares —
// one row per account/line item, one column per month, a running "Total/
// Rata-rata" column at the end so a whole year reads at a glance instead of
// forcing a click-through per month.
export function MonthlyReportTable({
  rows,
  year,
  upToMonth,
  totalLabel = "Total",
  totalMode = "sum",
}: {
  rows: MonthlyReportRow[];
  year: number;
  /** Months after this (0-indexed) render blank/dashed — no data exists yet
   * for a future month within the current year. */
  upToMonth: number;
  totalLabel?: string;
  /** "sum" for movement rows (Laba Rugi, Arus Kas — 12 months add up to a
   * year total); "average" for a monthly-run-rate view; "latest" for
   * cumulative/point-in-time rows (Neraca — summing 12 snapshots of the
   * same running balance is meaningless, the trailing column should just
   * show where that balance currently stands). */
  totalMode?: "sum" | "average" | "latest";
}) {
  return (
    // Bounded height + overflow-y-auto turns this into a real scrolling grid
    // (like each report was in the original spreadsheet), which is what lets
    // the <thead> below use a plain `sticky top-0` to freeze — see the note
    // on Table's `wrapperClassName` for why an unbounded overflow-x-auto div
    // can't support a viewport-relative sticky header on its own.
    <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
      <table className="w-full min-w-max border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Akun
            </th>
            {MONTH_LABELS.map((m, i) => (
              <th
                key={m}
                className={cn(
                  "sticky top-0 z-20 min-w-[76px] border-b border-slate-200 bg-slate-50 px-2 py-2 text-right text-[11px] font-bold uppercase tracking-wide",
                  i > upToMonth ? "text-slate-300" : "text-slate-500",
                )}
              >
                {m} {String(year).slice(2)}
              </th>
            ))}
            <th className="sticky top-0 z-20 min-w-[92px] border-b border-l-2 border-slate-300 bg-slate-100 px-2 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-brand-900">
              {totalLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const style = row.style ?? "normal";
            const mode = row.totalMode ?? totalMode;
            const sum = row.values.slice(0, upToMonth + 1).reduce((s, v) => s + v, 0);
            const totalValue = mode === "latest" ? (row.values[upToMonth] ?? 0) : mode === "average" && upToMonth >= 0 ? sum / (upToMonth + 1) : sum;
            return (
              <tr key={`${row.code ?? row.label}-${ri}`} className={cn("border-b border-slate-100", ROW_STYLE[style])}>
                <td
                  className={cn(
                    "sticky left-0 z-10 min-w-[220px] border-r border-slate-200 px-3 py-1.5",
                    style === "header" || style === "total" ? "bg-inherit" : "bg-white",
                    row.indent && "pl-7",
                  )}
                >
                  {row.code && <span className="mr-1.5 font-mono text-[10px] text-slate-400">{row.code}</span>}
                  {row.label}
                </td>
                {row.values.map((v, mi) => (
                  <td key={mi} className={cn("px-2 py-1.5 text-right tabular-nums", mi > upToMonth && "text-slate-300")}>
                    {mi > upToMonth ? "·" : formatCell(v, row.negative)}
                  </td>
                ))}
                <td className="border-l-2 border-slate-300 bg-slate-50 px-2 py-1.5 text-right font-bold tabular-nums text-brand-900">
                  {formatCell(totalValue, row.negative)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
