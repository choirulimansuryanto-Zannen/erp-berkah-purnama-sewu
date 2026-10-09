import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { getAnnualFinancialSummary, type AnnualFinancialSummary } from "@/lib/accounting";
import { cn } from "@/lib/cn";

const currency = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
function cell(v: number): string {
  if (v === 0) return "-";
  const text = currency.format(Math.abs(v));
  return v < 0 ? `(${text})` : text;
}
function pct(current: number, prior: number): string {
  if (prior === 0) return current === 0 ? "-" : "n/a";
  const growth = ((current - prior) / Math.abs(prior)) * 100;
  return `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`;
}

type Row = { label: string; key: keyof AnnualFinancialSummary; style?: "subtotal" | "total"; negative?: boolean };

const LABA_RUGI_ROWS: Row[] = [
  { label: "Total Penjualan", key: "totalPenjualan", style: "total" },
  { label: "Dikurangi HPP (Basis Kas)", key: "hpp", negative: true },
  { label: "Laba Kotor", key: "labaKotor", style: "total" },
  { label: "Beban Operasional", key: "bebanOperasional", negative: true },
  { label: "Laba Operasi", key: "labaOperasi", style: "total" },
  { label: "Pendapatan Non Operasi", key: "pendapatanNonOperasi" },
  { label: "Beban Non Operasi", key: "bebanNonOperasi", negative: true },
  { label: "Laba Sebelum Pajak", key: "labaSebelumPajak", style: "total" },
  { label: "Pajak Penghasilan", key: "pajakPenghasilan", negative: true },
  { label: "Laba Bersih Setelah Accrual", key: "labaBersih", style: "total" },
];

const NERACA_ROWS: Row[] = [
  { label: "Total Aktiva", key: "totalAktiva", style: "total" },
  { label: "Total Kewajiban", key: "totalKewajiban" },
  { label: "Total Ekuitas", key: "totalEkuitas", style: "total" },
];

const ROW_STYLE: Record<string, string> = {
  subtotal: "bg-slate-50 font-bold text-brand-900",
  total: "bg-gold-400 font-bold text-brand-950",
};
// Explicit (not `bg-inherit`) per-style background for the sticky first
// column — `background: inherit` on a sticky cell is a known trigger for
// a Chromium repaint bug where other columns' content "ghosts" through
// behind it while scrolling.
const ROW_STICKY_BG: Record<string, string> = {
  subtotal: "bg-slate-50",
  total: "bg-gold-400",
};

// Perbandingan Tahunan — HPP/Laba Rugi/Neraca headline figures side by
// side across years, all sourced from getAnnualFinancialSummary (which
// itself just wraps the same per-year engine every single-year report
// page reads), so a multi-year trend can never disagree with what that
// year's own report shows.
export default async function AnnualComparisonPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i);
  const summaries = await Promise.all(years.map((y) => getAnnualFinancialSummary(y)));

  function renderTable(title: string, rows: Row[]) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[var(--shadow-card)]">
        <div className="bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">{title}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky will-change-transform left-0 z-10 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Metrik
                </th>
                {years.map((y) => (
                  <th key={y} className="min-w-[130px] border-b border-slate-200 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {y}
                  </th>
                ))}
                <th className="min-w-[100px] border-b border-l-2 border-slate-300 bg-slate-100 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-brand-900">
                  YoY Terakhir
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const values = summaries.map((s) => s[r.key] as number);
                const last = values[values.length - 1];
                const prior = values[values.length - 2];
                return (
                  <tr key={r.key} className={cn("border-b border-slate-100", r.style ? ROW_STYLE[r.style] : "text-slate-700")}>
                    <td className={cn("sticky will-change-transform left-0 z-10 border-r border-slate-200 px-3 py-1.5", r.style ? ROW_STICKY_BG[r.style] : "bg-white")}>{r.label}</td>
                    {values.map((v, i) => (
                      <td key={years[i]} className="px-3 py-1.5 text-right tabular-nums">
                        {r.negative ? cell(-Math.abs(v)) : cell(v)}
                      </td>
                    ))}
                    <td className="border-l-2 border-slate-300 bg-slate-50 px-3 py-1.5 text-right font-semibold tabular-nums text-brand-900">
                      {pct(last, prior)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perbandingan Tahunan"
        description="Angka utama HPP, Laba Rugi, dan Neraca berdampingan lintas tahun — untuk melihat tren pertumbuhan/penurunan dari tahun ke tahun."
      />
      {renderTable(`Laba Rugi & HPP — ${years[0]}–${years[years.length - 1]}`, LABA_RUGI_ROWS)}
      {renderTable(`Neraca (posisi akhir tahun) — ${years[0]}–${years[years.length - 1]}`, NERACA_ROWS)}
    </div>
  );
}
