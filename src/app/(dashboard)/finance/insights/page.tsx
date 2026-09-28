import { redirect } from "next/navigation";
import { AlertTriangle, TrendingUp, TrendingDown, Wallet, Target, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMonthlyAccountMatrix, getMonthlyCashFlow, getMonthlyHppReport, computeLabaBersihSeries } from "@/lib/accounting";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const ZERO_12 = () => Array.from({ length: 12 }, () => 0);

function sumType(matrix: Awaited<ReturnType<typeof getMonthlyAccountMatrix>>, type: string, field: "monthly" | "opening" = "monthly") {
  const out = ZERO_12();
  for (const a of matrix.filter((r) => r.type === type)) {
    if (field === "monthly") a.monthly.forEach((v, i) => (out[i] += v));
  }
  return out;
}

export default async function FinanceInsightsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const now = new Date();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const upToMonth = year === now.getFullYear() ? now.getMonth() : 11;
  const activeMonths = Array.from({ length: upToMonth + 1 }, (_, i) => i);

  const [matrix, cashFlowLines, hppReport] = await Promise.all([
    getMonthlyAccountMatrix(year),
    getMonthlyCashFlow(year),
    getMonthlyHppReport(year),
  ]);

  const pendapatan = sumType(matrix, "PENDAPATAN");
  const hpp = hppReport.cashBasisHpp;
  const bebanOperasional = sumType(matrix, "BEBAN_OPERASIONAL");
  const labaBersih = computeLabaBersihSeries(matrix, hppReport.cashBasisHpp);

  const grossMargin = activeMonths.map((m) => (pendapatan[m] > 0 ? ((pendapatan[m] - hpp[m]) / pendapatan[m]) * 100 : 0));
  const netMargin = activeMonths.map((m) => (pendapatan[m] > 0 ? (labaBersih[m] / pendapatan[m]) * 100 : 0));
  const expenseRatio = activeMonths.map((m) => (pendapatan[m] > 0 ? (bebanOperasional[m] / pendapatan[m]) * 100 : 0));

  const ytdPendapatan = activeMonths.reduce((s, m) => s + pendapatan[m], 0);
  const ytdLabaBersih = activeMonths.reduce((s, m) => s + labaBersih[m], 0);
  const ytdNetMargin = ytdPendapatan > 0 ? (ytdLabaBersih / ytdPendapatan) * 100 : 0;

  const operatingCF = ZERO_12();
  for (const l of cashFlowLines.filter((l) => l.activity === "OPERASI")) l.monthly.forEach((v, i) => (operatingCF[i] += v));
  const ytdOperatingCF = activeMonths.reduce((s, m) => s + operatingCF[m], 0);

  // Best/worst month by revenue, among months that actually have data.
  const monthsWithRevenue = activeMonths.filter((m) => pendapatan[m] > 0);
  const bestMonth = monthsWithRevenue.length
    ? monthsWithRevenue.reduce((best, m) => (pendapatan[m] > pendapatan[best] ? m : best))
    : null;
  const worstMonth = monthsWithRevenue.length
    ? monthsWithRevenue.reduce((worst, m) => (pendapatan[m] < pendapatan[worst] ? m : worst))
    : null;

  // Month-over-month revenue growth — flags any month that dropped >15%.
  const declines: { month: number; pct: number }[] = [];
  for (let m = 1; m <= upToMonth; m++) {
    if (pendapatan[m - 1] > 0) {
      const pct = ((pendapatan[m] - pendapatan[m - 1]) / pendapatan[m - 1]) * 100;
      if (pct < -15) declines.push({ month: m, pct });
    }
  }

  // Which single expense account (Beban Operasional) is the single biggest
  // YTD line — the "where is the money actually going" question.
  const bebanOpAccounts = matrix.filter((a) => a.type === "BEBAN_OPERASIONAL");
  const bebanOpYtd = bebanOpAccounts
    .map((a) => ({ name: a.name, total: activeMonths.reduce((s, m) => s + a.monthly[m], 0) }))
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);
  const topExpense = bebanOpYtd[0] ?? null;

  const negativeOpMonths = activeMonths.filter((m) => operatingCF[m] < 0).length;
  const cfLagsIncome = ytdOperatingCF < ytdLabaBersih * 0.7 && ytdLabaBersih > 0;

  const asetAccounts = matrix.filter((a) => a.type === "ASET");
  const kewajibanAccounts = matrix.filter((a) => a.type === "KEWAJIBAN");
  const totalAset = asetAccounts.reduce((s, a) => s + a.cumulative[upToMonth], 0);
  const totalKewajiban = kewajibanAccounts.reduce((s, a) => s + a.cumulative[upToMonth], 0);
  const cashAccounts = matrix.filter((a) => a.cashBook);
  const totalCash = cashAccounts.reduce((s, a) => s + a.cumulative[upToMonth], 0);
  const solvencyRatio = totalKewajiban > 0 ? totalAset / totalKewajiban : null;
  const cashCoverageRatio = totalKewajiban > 0 ? totalCash / totalKewajiban : null;

  const marginTrendDelta = activeMonths.length >= 2 ? netMargin[upToMonth] - netMargin[0] : 0;

  const findings: { tone: "success" | "warning" | "danger" | "info"; text: string }[] = [];

  if (bestMonth !== null && worstMonth !== null && bestMonth !== worstMonth) {
    findings.push({
      tone: "info",
      text: `Omset tertinggi tahun ${year} terjadi bulan ${MONTH_NAMES[bestMonth]} (${currency.format(pendapatan[bestMonth])}), sedangkan terendah di bulan ${MONTH_NAMES[worstMonth]} (${currency.format(pendapatan[worstMonth])}) — selisih ${currency.format(pendapatan[bestMonth] - pendapatan[worstMonth])}.`,
    });
  }
  if (declines.length > 0) {
    findings.push({
      tone: "warning",
      text: `Ada ${declines.length} bulan dengan penurunan omset tajam (>15% dari bulan sebelumnya): ${declines.map((d) => `${MONTH_NAMES[d.month]} (${d.pct.toFixed(0)}%)`).join(", ")} — perlu dicek penyebabnya.`,
    });
  }
  if (marginTrendDelta !== 0 && activeMonths.length >= 2) {
    findings.push({
      tone: marginTrendDelta >= 0 ? "success" : "warning",
      text: `Margin laba bersih bergerak dari ${netMargin[0].toFixed(1)}% (${MONTH_NAMES[0]}) menjadi ${netMargin[upToMonth].toFixed(1)}% (${MONTH_NAMES[upToMonth]}) — ${marginTrendDelta >= 0 ? "membaik" : "melemah"} ${Math.abs(marginTrendDelta).toFixed(1)} poin persentase.`,
    });
  }
  if (topExpense) {
    findings.push({
      tone: "info",
      text: `Pos beban operasional terbesar tahun berjalan adalah "${topExpense.name}" senilai ${currency.format(topExpense.total)} — ${((topExpense.total / (bebanOperasional.reduce((s, v, i) => (activeMonths.includes(i) ? s + v : s), 0) || 1)) * 100).toFixed(0)}% dari total beban operasional.`,
    });
  }
  if (negativeOpMonths > 0) {
    findings.push({
      tone: "danger",
      text: `Arus kas operasi negatif di ${negativeOpMonths} dari ${activeMonths.length} bulan berjalan — kas masuk dari operasi bisnis tidak menutup pengeluaran operasionalnya sendiri pada bulan-bulan tersebut.`,
    });
  } else if (activeMonths.length > 0) {
    findings.push({ tone: "success", text: `Arus kas operasi positif di seluruh ${activeMonths.length} bulan berjalan tahun ${year} — bisnis menghasilkan kas dari operasionalnya sendiri secara konsisten.` });
  }
  if (cfLagsIncome) {
    findings.push({
      tone: "warning",
      text: `Arus kas operasi (${currency.format(ytdOperatingCF)}) jauh di bawah laba bersih (${currency.format(ytdLabaBersih)}) — indikasi laba yang tercatat belum sepenuhnya berubah jadi kas riil (mis. piutang belum tertagih).`,
    });
  }
  if (solvencyRatio !== null) {
    findings.push({
      tone: solvencyRatio >= 1.5 ? "success" : solvencyRatio >= 1 ? "warning" : "danger",
      text: `Rasio Aset terhadap Kewajiban saat ini ${solvencyRatio.toFixed(2)}x (${currency.format(totalAset)} vs ${currency.format(totalKewajiban)}) — ${solvencyRatio >= 1.5 ? "posisi solvabilitas sehat" : solvencyRatio >= 1 ? "masih di atas 1x tapi tipis, perlu dipantau" : "kewajiban melebihi aset, perlu perhatian segera"}.`,
    });
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const TONE_ICON = { success: TrendingUp, warning: AlertTriangle, danger: AlertTriangle, info: Sparkles };
  const TONE_CLASS: Record<string, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-rose-200 bg-rose-50 text-rose-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analisis & Insight Keuangan"
        description="Identifikasi otomatis dari Laba Rugi, Neraca, dan Arus Kas — dihitung langsung dari jurnal, bukan ringkasan manual."
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
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={`Pendapatan YTD ${year}`} value={currency.format(ytdPendapatan)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        <StatCard
          label="Laba Bersih YTD"
          value={currency.format(ytdLabaBersih)}
          tone={ytdLabaBersih >= 0 ? "success" : "danger"}
          icon={ytdLabaBersih >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        />
        <StatCard label="Margin Laba Bersih" value={`${ytdNetMargin.toFixed(1)}%`} tone={ytdNetMargin >= 10 ? "success" : ytdNetMargin >= 0 ? "warning" : "danger"} icon={<Target className="h-4 w-4" />} />
        <StatCard label="Arus Kas Operasi YTD" value={currency.format(ytdOperatingCF)} tone={ytdOperatingCF >= 0 ? "success" : "danger"} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Temuan Utama</CardTitle>
        </CardHeader>
        <ul className="space-y-3 p-5 pt-2">
          {findings.map((f, i) => {
            const Icon = TONE_ICON[f.tone];
            return (
              <li key={i} className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm leading-relaxed ${TONE_CLASS[f.tone]}`}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{f.text}</span>
              </li>
            );
          })}
          {findings.length === 0 && <li className="text-center text-sm text-slate-400">Belum cukup data untuk dianalisis.</li>}
        </ul>
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader>
          <CardTitle>Tren Margin Bulanan</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-2 text-left font-bold uppercase text-slate-500">Metrik</th>
                {activeMonths.map((m) => (
                  <th key={m} className="min-w-[70px] px-2 py-2 text-right font-bold uppercase text-slate-500">
                    {MONTH_NAMES[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">Margin Kotor</td>
                {activeMonths.map((m) => (
                  <td key={m} className="px-2 py-2 text-right tabular-nums">{grossMargin[m].toFixed(1)}%</td>
                ))}
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">Rasio Beban / Pendapatan</td>
                {activeMonths.map((m) => (
                  <td key={m} className="px-2 py-2 text-right tabular-nums">{expenseRatio[m].toFixed(1)}%</td>
                ))}
              </tr>
              <tr className="border-t border-slate-100 bg-amber-50/50 font-bold text-brand-900">
                <td className="px-3 py-2">Margin Bersih</td>
                {activeMonths.map((m) => (
                  <td key={m} className="px-2 py-2 text-right tabular-nums">{netMargin[m].toFixed(1)}%</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rasio Solvabilitas & Likuiditas (posisi terakhir)</CardTitle>
          </CardHeader>
          <div className="space-y-3 p-5 pt-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Total Aset</span>
              <span className="font-semibold text-slate-800">{currency.format(totalAset)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Total Kewajiban</span>
              <span className="font-semibold text-slate-800">{currency.format(totalKewajiban)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="font-medium text-slate-700">Rasio Aset / Kewajiban</span>
              <Badge tone={solvencyRatio === null ? "neutral" : solvencyRatio >= 1.5 ? "success" : solvencyRatio >= 1 ? "warning" : "danger"}>
                {solvencyRatio === null ? "-" : `${solvencyRatio.toFixed(2)}x`}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">Rasio Kas / Kewajiban</span>
              <Badge tone={cashCoverageRatio === null ? "neutral" : cashCoverageRatio >= 0.5 ? "success" : "warning"}>
                {cashCoverageRatio === null ? "-" : `${cashCoverageRatio.toFixed(2)}x`}
              </Badge>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulan Terbaik & Terlemah ({year})</CardTitle>
          </CardHeader>
          <div className="space-y-3 p-5 pt-2 text-sm">
            {bestMonth !== null && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Omset Tertinggi</p>
                <p className="mt-1 text-lg font-bold text-emerald-900">{MONTH_NAMES[bestMonth]} {year}</p>
                <p className="text-xs text-emerald-700">{currency.format(pendapatan[bestMonth])}</p>
              </div>
            )}
            {worstMonth !== null && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Omset Terendah</p>
                <p className="mt-1 text-lg font-bold text-rose-900">{MONTH_NAMES[worstMonth]} {year}</p>
                <p className="text-xs text-rose-700">{currency.format(pendapatan[worstMonth])}</p>
              </div>
            )}
            {bestMonth === null && <p className="text-center text-slate-400">Belum ada data omset.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
