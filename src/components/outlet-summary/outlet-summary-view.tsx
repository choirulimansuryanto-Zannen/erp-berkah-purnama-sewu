import { ChevronLeft, ChevronRight, Sparkles, Target, TrendingUp, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, Thead, Th } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { AchievementTier, DailyAchievementRow, DailyOnlyRow } from "@/lib/outlet-achievement";
import { ACHIEVEMENT_TIERS } from "@/lib/outlet-achievement";
import { ZONE_STYLES } from "./zone-styles";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateLabelFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const MONTH_LABELS = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER",
];

function HeroTile({ label, value, hint, tierZone }: { label: string; value: string; hint?: string; tierZone?: AchievementTier["zone"] }) {
  const toneClass = tierZone ? ZONE_STYLES[tierZone].onDark : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-1.5 text-xl font-bold tabular-nums", toneClass)}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function AlertBadge({ tier }: { tier: AchievementTier }) {
  const style = ZONE_STYLES[tier.zone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold", style.badge)}>
      {tier.alertLabel}
    </span>
  );
}

function ZoneLegend() {
  // One representative tier per zone, in zone order (best → worst).
  const reps = [
    ACHIEVEMENT_TIERS.find((t) => t.zone === "HIJAU")!,
    ACHIEVEMENT_TIERS.find((t) => t.zone === "KUNING")!,
    ACHIEVEMENT_TIERS.find((t) => t.zone === "JINGGA")!,
    ACHIEVEMENT_TIERS.find((t) => t.zone === "MERAH")!,
    ACHIEVEMENT_TIERS.find((t) => t.zone === "HITAM")!,
  ];
  const ranges: Record<string, string> = {
    HIJAU: "≥ 90%",
    KUNING: "70 - 89%",
    JINGGA: "50 - 69%",
    MERAH: "10 - 49%",
    HITAM: "0%",
  };
  return (
    <div className="flex flex-wrap gap-2">
      {reps.map((tier) => {
        const style = ZONE_STYLES[tier.zone];
        return (
          <span key={tier.zone} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
            <span className={cn("h-2 w-2 rounded-full", style.dot)} />
            {style.label} <span className="text-slate-400">({ranges[tier.zone]})</span>
          </span>
        );
      })}
    </div>
  );
}

function CoachingCard({ row }: { row: DailyAchievementRow }) {
  const style = ZONE_STYLES[row.tier.zone];
  return (
    <Card className={cn("overflow-hidden border-0 p-0 shadow-[var(--shadow-card)]")}>
      <div className={cn("flex flex-wrap items-center justify-between gap-2 px-5 py-3", style.solid)}>
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4" />
          <p className="text-xs font-bold uppercase tracking-wide">Coaching Hari Ini · {dateLabelFormat.format(row.date)}</p>
        </div>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
          {row.tier.statusLabel}
        </span>
      </div>
      <div className="space-y-2 bg-white p-5">
        <p className="text-sm font-bold text-brand-900">{row.tier.alertLabel}</p>
        <p className="text-sm leading-relaxed text-slate-600">{row.tier.message}</p>
        <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Achievement berjalan: {currency.format(row.achievementBerjalan)} / {currency.format(row.targetBerjalan)} · {Math.round(row.persentase)}%
        </p>
      </div>
    </Card>
  );
}

function DailyOnlyTable({
  title,
  icon,
  targetLabel,
  achievementLabel,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  targetLabel: string;
  achievementLabel: string;
  rows: DailyOnlyRow[];
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
        {icon}
        <p className="text-xs font-bold uppercase tracking-wide text-brand-900">{title}</p>
      </div>
      <Table>
        <Thead>
          <tr>
            <Th>Tanggal</Th>
            <Th className="text-right">{targetLabel}</Th>
            <Th className="text-right">{achievementLabel}</Th>
            <Th className="text-right">Persentase</Th>
            <Th>Alert</Th>
          </tr>
        </Thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                Belum ada data untuk bulan ini.
              </td>
            </tr>
          )}
          {[...rows].reverse().map((row) => {
            const style = ZONE_STYLES[row.tier.zone];
            return (
              <tr key={row.day} className={cn("border-t border-l-4 border-slate-100 hover:bg-slate-50/60", style.rowBorder)}>
                <td className="px-5 py-3 font-medium text-slate-700">{dateLabelFormat.format(row.date)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-600">{currency.format(row.targetHarian)}</td>
                <td className="px-5 py-3 text-right tabular-nums font-semibold text-brand-900">{currency.format(row.achievementHarian)}</td>
                <td className={cn("px-5 py-3 text-right text-sm font-bold tabular-nums", style.dot.replace("bg-", "text-"))}>
                  {Math.round(row.persentase)}%
                </td>
                <td className="px-5 py-3">
                  <AlertBadge tier={row.tier} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

export function OutletSummaryView({
  monthLabel,
  year,
  month,
  canGoNext,
  omsetBerjalan,
  targetBulanan,
  persenTercapai,
  proyeksiAkhirBulan,
  daysElapsed,
  daysInMonth,
  rows,
  overallTier,
  fullshiftRows,
  dailyRows,
}: {
  monthLabel: string;
  year: number;
  month: number;
  canGoNext: boolean;
  omsetBerjalan: number;
  targetBulanan: number;
  persenTercapai: number;
  proyeksiAkhirBulan: number;
  daysElapsed: number;
  daysInMonth: number;
  rows: DailyAchievementRow[];
  overallTier: AchievementTier | null;
  fullshiftRows: DailyOnlyRow[];
  dailyRows: DailyOnlyRow[];
}) {
  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const latestRow = rows[rows.length - 1] ?? null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-0 p-0 shadow-[var(--shadow-card)]">
        <div className="rounded-xl bg-brand-950 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gold-400" />
              <p className="text-xs font-bold uppercase tracking-wide text-white">Achievement Target Berjalan · {monthLabel}</p>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={`/outlet-summary?year=${prevMonth.year}&month=${prevMonth.month}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </a>
              {canGoNext ? (
                <a
                  href={`/outlet-summary?year=${nextMonth.year}&month=${nextMonth.month}`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                  aria-label="Bulan berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </a>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600">
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HeroTile label="Omset Berjalan" value={currency.format(omsetBerjalan)} />
              <HeroTile label="Target Bulanan" value={currency.format(targetBulanan)} />
              <HeroTile
                label="% Tercapai"
                value={targetBulanan > 0 ? `${Math.round(persenTercapai)}%` : "-"}
                tierZone={overallTier?.zone}
              />
              <HeroTile label="Proyeksi Akhir Bulan" value={currency.format(proyeksiAkhirBulan)} />
            </div>
            <p className="text-xs text-slate-400">
              Sampai hari ke-{daysElapsed} dari {daysInMonth} hari pada bulan terpilih.
            </p>
          </div>
        </div>
      </Card>

      <ZoneLegend />

      {latestRow ? (
        <CoachingCard row={latestRow} />
      ) : (
        <Card className="p-5 text-center text-sm text-slate-500">Belum ada data achievement untuk bulan ini.</Card>
      )}

      <Card className="overflow-hidden p-0">
        <Table>
          <Thead>
            <tr>
              <Th>Tanggal</Th>
              <Th className="text-right">Target Berjalan</Th>
              <Th className="text-right">Achievement Berjalan</Th>
              <Th className="text-right">Persentase</Th>
              <Th>Alert</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                  Belum ada data achievement untuk bulan ini.
                </td>
              </tr>
            )}
            {[...rows].reverse().map((row) => {
              const style = ZONE_STYLES[row.tier.zone];
              return (
                <tr key={row.day} className={cn("border-t border-l-4 border-slate-100 hover:bg-slate-50/60", style.rowBorder)}>
                  <td className="px-5 py-3 font-medium text-slate-700">{dateLabelFormat.format(row.date)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-600">{currency.format(row.targetBerjalan)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-brand-900">{currency.format(row.achievementBerjalan)}</td>
                  <td className={cn("px-5 py-3 text-right text-sm font-bold tabular-nums", style.dot.replace("bg-", "text-"))}>
                    {Math.round(row.persentase)}%
                  </td>
                  <td className="px-5 py-3">
                    <AlertBadge tier={row.tier} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <DailyOnlyTable
        title="Achievement Harian vs Target Fullshift"
        icon={<Zap className="h-4 w-4 text-accent-600" />}
        targetLabel="Target Fullshift"
        achievementLabel="Achievement Harian"
        rows={fullshiftRows}
      />

      <DailyOnlyTable
        title="Achievement Harian vs Target Harian"
        icon={<Target className="h-4 w-4 text-accent-600" />}
        targetLabel="Target Harian"
        achievementLabel="Achievement Harian"
        rows={dailyRows}
      />
    </div>
  );
}

export { MONTH_LABELS };
