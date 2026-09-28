import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { computeMonthlyAchievementSeries, computeDailyOnlySeries, getAchievementTier } from "@/lib/outlet-achievement";
import { OutletSummaryView, MONTH_LABELS } from "@/components/outlet-summary/outlet-summary-view";

export default async function OutletSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "PRAMUNIAGA" || !user.outletId) redirect("/dashboard");

  const outletId = user.outletId;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const { year: yearParam, month: monthParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : currentYear;
  const month = monthParam ? Number(monthParam) : currentMonth;

  const isCurrentMonth = year === currentYear && month === currentMonth;
  const isFutureMonth = year > currentYear || (year === currentYear && month > currentMonth);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysElapsed = isFutureMonth ? 0 : isCurrentMonth ? now.getDate() : daysInMonth;
  const canGoNext = !isCurrentMonth && !isFutureMonth;

  const [monthlyTargetRow, outlet, transactions] = await Promise.all([
    prisma.outletMonthlyTarget.findUnique({ where: { outletId_year_month: { outletId, year, month } } }),
    prisma.outlet.findUnique({ where: { id: outletId } }),
    daysElapsed > 0
      ? prisma.transaction.findMany({
          where: {
            outletId,
            status: "COMPLETED",
            createdAt: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) },
          },
          select: { createdAt: true, total: true },
        })
      : Promise.resolve([]),
  ]);

  const dailyTarget = Number(monthlyTargetRow?.dailyTarget ?? outlet?.dailyTarget ?? 0);
  const targetBulanan = Number(monthlyTargetRow?.monthlyTarget ?? outlet?.monthlyTarget ?? 0);
  const fullshiftDailyTarget = Number(monthlyTargetRow?.fullshiftDailyTarget ?? outlet?.fullshiftTarget ?? 0);

  const dailyActualByDay = new Map<number, number>();
  for (const tx of transactions) {
    const day = tx.createdAt.getDate();
    dailyActualByDay.set(day, (dailyActualByDay.get(day) ?? 0) + Number(tx.total));
  }

  const rows = computeMonthlyAchievementSeries({ year, month, dailyTarget, dailyActualByDay, daysElapsed });
  const omsetBerjalan = rows.length > 0 ? rows[rows.length - 1].achievementBerjalan : 0;
  const persenTercapai = targetBulanan > 0 ? (omsetBerjalan / targetBulanan) * 100 : 0;
  const proyeksiAkhirBulan = daysElapsed > 0 ? (omsetBerjalan / daysElapsed) * daysInMonth : 0;
  const overallTier = targetBulanan > 0 ? getAchievementTier(persenTercapai, omsetBerjalan) : null;

  const fullshiftRows = computeDailyOnlySeries({ year, month, dailyTarget: fullshiftDailyTarget, dailyActualByDay, daysElapsed });
  const dailyRows = computeDailyOnlySeries({ year, month, dailyTarget, dailyActualByDay, daysElapsed });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan Outlet"
        description="Achievement outlet terhadap target — harian, up-to-date, dan proyeksi akhir bulan."
      />
      <OutletSummaryView
        monthLabel={`${MONTH_LABELS[month - 1]} ${year}`}
        year={year}
        month={month}
        canGoNext={canGoNext}
        omsetBerjalan={omsetBerjalan}
        targetBulanan={targetBulanan}
        persenTercapai={persenTercapai}
        proyeksiAkhirBulan={proyeksiAkhirBulan}
        daysElapsed={daysElapsed}
        daysInMonth={daysInMonth}
        rows={rows}
        overallTier={overallTier}
        fullshiftRows={fullshiftRows}
        dailyRows={dailyRows}
      />
    </div>
  );
}
