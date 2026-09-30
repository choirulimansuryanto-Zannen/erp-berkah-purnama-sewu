import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMonthlyCashFlow, getMonthlyAccountMatrix } from "@/lib/accounting";
import { MonthlyReportTable, type MonthlyReportRow } from "@/components/finance/monthly-report-table";
import { FormattedBarChart } from "@/components/ui/formatted-charts";
import { StatCard } from "@/components/ui/stat-card";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import type { CashFlowActivity } from "@/lib/accounting";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const MONTH_LABELS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const ZERO_12 = () => Array.from({ length: 12 }, () => 0);
function addSeries(...series: number[][]): number[] {
  return ZERO_12().map((_, i) => series.reduce((s, arr) => s + arr[i], 0));
}

const ACTIVITY_LABEL: Record<CashFlowActivity, string> = {
  OPERASI: "Aktivitas Operasi",
  INVESTASI: "Aktivitas Investasi",
  PENDANAAN: "Aktivitas Pendanaan",
};

// Direct-method cash flow — every line here is a real KAS_MASUK/KAS_KELUAR
// voucher's own cash impact, grouped by activity then by contra account, so
// it reconciles exactly against the six cash books' own movement (shown at
// the bottom as a built-in cross-check, not just asserted).
export default async function CashFlowPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;

  const [cashFlowLines, matrix] = await Promise.all([getMonthlyCashFlow(year), getMonthlyAccountMatrix(year)]);

  const activities: CashFlowActivity[] = ["OPERASI", "INVESTASI", "PENDANAAN"];
  const rows: MonthlyReportRow[] = [];
  const activityTotals: Record<CashFlowActivity, number[]> = { OPERASI: ZERO_12(), INVESTASI: ZERO_12(), PENDANAAN: ZERO_12() };

  for (const activity of activities) {
    const lines = cashFlowLines.filter((l) => l.activity === activity);
    const total = addSeries(...lines.map((l) => l.monthly));
    activityTotals[activity] = total;
    rows.push({ label: ACTIVITY_LABEL[activity], values: total, style: "subtotal" });
    for (const l of lines) {
      if (l.monthly.every((v) => v === 0)) continue;
      rows.push({ code: l.code, label: l.label, values: l.monthly, indent: true });
    }
  }

  const netChange = addSeries(activityTotals.OPERASI, activityTotals.INVESTASI, activityTotals.PENDANAAN);

  const cashAccounts = matrix.filter((a) => a.cashBook);
  const totalCashOpening = cashAccounts.reduce((s, a) => s + a.opening, 0);
  const totalCashCumulative = addSeries(...cashAccounts.map((a) => a.cumulative));
  let running = totalCashOpening;
  const cashPosition = netChange.map((_, i) => {
    running += netChange[i];
    return running;
  });
  const reconciles = Math.abs(cashPosition[upToMonth] - totalCashCumulative[upToMonth]) < 1;

  rows.push({ label: "Kenaikan (Penurunan) Kas Bersih", values: netChange, style: "total" });
  rows.push({ label: "Kas & Setara Kas Akhir Periode (kumulatif)", values: cashPosition, style: "total", totalMode: "latest" });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const ytdByActivity = [
    { name: "Aktivitas Operasi", value: activityTotals.OPERASI.slice(0, upToMonth + 1).reduce((s, v) => s + v, 0), color: "#0f9d58" },
    { name: "Aktivitas Investasi", value: activityTotals.INVESTASI.slice(0, upToMonth + 1).reduce((s, v) => s + v, 0), color: "#2f56c4" },
    { name: "Aktivitas Pendanaan", value: activityTotals.PENDANAAN.slice(0, upToMonth + 1).reduce((s, v) => s + v, 0), color: "#7c3aed" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Arus Kas"
        description="Metode langsung — setiap voucher Kas Masuk/Kas Keluar dikelompokkan per aktivitas (Operasi/Investasi/Pendanaan). Transfer Antar Buku tidak dihitung karena tidak mengubah total kas."
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
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
            className={`ml-auto rounded-full px-3 py-1.5 text-xs font-bold ${reconciles ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
          >
            {reconciles ? "✓ Sesuai dengan saldo 6 buku kas" : "⚠ Tidak sesuai — cek jurnal"}
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Kas Awal Tahun" value={currency.format(totalCashOpening)} tone="neutral" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label={`Kas Akhir (s/d bulan ini)`} value={currency.format(cashPosition[upToMonth])} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        <StatCard
          label="Arus Kas Operasi (YTD)"
          value={currency.format(activityTotals.OPERASI.slice(0, upToMonth + 1).reduce((s, v) => s + v, 0))}
          tone={activityTotals.OPERASI.slice(0, upToMonth + 1).reduce((s, v) => s + v, 0) >= 0 ? "success" : "danger"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Kenaikan (Penurunan) Kas (YTD)"
          value={currency.format(netChange.slice(0, upToMonth + 1).reduce((s, v) => s + v, 0))}
          tone={netChange.slice(0, upToMonth + 1).reduce((s, v) => s + v, 0) >= 0 ? "success" : "danger"}
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </div>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-semibold text-brand-900">Arus Kas per Aktivitas (YTD s/d {MONTH_LABELS_ID[upToMonth]} {year})</p>
        </div>
        <div className="p-5">
          <FormattedBarChart data={ytdByActivity} format="currency" />
        </div>
      </Card>

      <Card className="p-0">
        <div className="sticky top-16 z-30 flex h-11 items-center rounded-t-xl bg-brand-950 px-5">
          <p className="text-sm font-bold uppercase tracking-wide text-white">Laporan Arus Kas — {year} (per bulan)</p>
        </div>
        <MonthlyReportTable rows={rows} year={year} upToMonth={upToMonth} totalLabel={`Total ${year}`} />
      </Card>
    </div>
  );
}
