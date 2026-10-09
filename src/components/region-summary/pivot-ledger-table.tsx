import { cn } from "@/lib/cn";

export type PivotRow = {
  label: string;
  values: (string | number)[];
  highlight?: "green" | "pink" | "cyan";
  format?: "currency" | "number" | "text";
};

const HIGHLIGHT_CLASSES: Record<NonNullable<PivotRow["highlight"]>, string> = {
  green: "bg-emerald-400 text-brand-950 font-bold",
  pink: "bg-rose-100 text-rose-800 font-bold",
  cyan: "bg-cyan-300 text-brand-950 font-semibold",
};

const currency = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function formatValue(v: string | number, format?: PivotRow["format"]): string {
  if (typeof v === "string") return v;
  if (format === "currency" || format === "number") return currency.format(v);
  return String(v);
}

// Wide spreadsheet-style pivot — one column per day, one row per metric —
// matching the outlet's own daily ledger format instead of a normal
// date-as-rows table, so a whole period's channel breakdown, running
// achievement, and who worked reads at a glance across the week.
export function PivotLedgerTable({
  title,
  days,
  rows,
}: {
  title: string;
  days: { label: string; sublabel: string }[];
  rows: PivotRow[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[var(--shadow-card)]">
      <div className="border-b border-slate-100 bg-brand-950 px-5 py-3">
        <p className="text-sm font-bold uppercase tracking-wide text-white">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky will-change-transform left-0 z-10 min-w-[160px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Detail
              </th>
              {days.map((d, i) => (
                <th key={i} className="min-w-[92px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-center">
                  <div className="text-[11px] font-bold text-slate-700">{d.label}</div>
                  <div className="text-[10px] font-normal text-slate-400">{d.sublabel}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-100">
                <td className="sticky will-change-transform left-0 z-10 min-w-[160px] border-r border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                  {row.label}
                </td>
                {row.values.map((v, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      "min-w-[92px] px-3 py-2 text-center text-xs tabular-nums text-slate-700",
                      row.highlight && HIGHLIGHT_CLASSES[row.highlight],
                    )}
                  >
                    {formatValue(v, row.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
