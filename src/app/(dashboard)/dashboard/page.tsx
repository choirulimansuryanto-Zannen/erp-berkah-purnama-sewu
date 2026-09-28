import Link from "next/link";
import type { Role } from "@prisma/client";
import { CheckCircle2, Clock3, FileText, ReceiptText, Store, Target, Zap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getScopedOutletIds } from "@/lib/outlet-scope";
import { getSessionDate, getSessionTimeRange, startOfToday } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const MANAGEMENT_ROLES: Role[] = ["SPV", "OFFICE", "MASTER_ADMIN", "FA_ADMIN"];

async function loadDashboardData(userId: string, role: Role, outletId: string | null) {
  try {
    if (MANAGEMENT_ROLES.includes(role)) {
      const scopedOutletIds = await getScopedOutletIds(userId, role);
      const outletFilter = scopedOutletIds ? { in: scopedOutletIds } : undefined;
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [pendingReports, pendingExpenses, activeOutlets, monthlyTargets, todayOmsetAgg] = await Promise.all([
        prisma.dailyReport.count({
          where: { status: "PENDING", ...(outletFilter ? { outletId: outletFilter } : {}) },
        }),
        prisma.expenseRecord.count({
          where: { approvalStatus: "PENDING", ...(outletFilter ? { outletId: outletFilter } : {}) },
        }),
        prisma.outlet.findMany({
          where: { status: "ACTIVE", ...(outletFilter ? { id: outletFilter } : {}) },
          select: { id: true, dailyTarget: true },
        }),
        // Seasonal per-outlet targets for the current month — each outlet's
        // target is different, so this is summed per outlet, not one flat
        // company-wide number.
        prisma.outletMonthlyTarget.findMany({
          where: {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            ...(scopedOutletIds ? { outletId: { in: scopedOutletIds } } : {}),
          },
        }),
        prisma.transaction.aggregate({
          where: { status: "COMPLETED", createdAt: { gte: today }, ...(outletFilter ? { outletId: outletFilter } : {}) },
          _sum: { total: true },
        }),
      ]);

      const targetByOutlet = new Map(monthlyTargets.map((t) => [t.outletId, Number(t.dailyTarget)]));
      const totalDailyTarget = activeOutlets.reduce(
        (sum, o) => sum + (targetByOutlet.get(o.id) ?? Number(o.dailyTarget)),
        0,
      );
      const todayOmset = Number(todayOmsetAgg._sum.total ?? 0);

      return {
        kind: "management" as const,
        pendingReports,
        pendingExpenses,
        outletCount: activeOutlets.length,
        todayOmset,
        totalDailyTarget,
        scoped: scopedOutletIds !== null,
      };
    }

    if (role === "PRAMUNIAGA" && outletId) {
      // Keyed to the open (or most recent) session, not the calendar day —
      // a shift that closes past midnight should still show as "today's".
      const sessionDate = await getSessionDate(userId);
      const sessionRange = (await getSessionTimeRange(userId)) ?? { from: startOfToday(), to: new Date() };
      const now = new Date();

      const [attendance, sessionReport, outlet, monthlyTarget, outletOmsetAgg] = await Promise.all([
        // Any of today's independent per-pramuniaga rows still open counts
        // as "checked in" for this compact dashboard card.
        prisma.attendanceRecord.findFirst({ where: { userId, date: sessionDate, timeOut: null } }),
        prisma.dailyReport.findFirst({ where: { pramuniagaId: userId, date: sessionDate } }),
        prisma.outlet.findUnique({ where: { id: outletId } }),
        prisma.outletMonthlyTarget.findUnique({
          where: { outletId_year_month: { outletId, year: now.getFullYear(), month: now.getMonth() + 1 } },
        }),
        prisma.transaction.aggregate({
          where: { outletId, status: "COMPLETED", createdAt: { gte: sessionRange.from } },
          _sum: { total: true },
        }),
      ]);

      const outletOmset = Number(outletOmsetAgg._sum.total ?? 0);
      // Seasonal per-month target (see OutletMonthlyTarget) if the current
      // month has been loaded, otherwise the outlet's static fallback — same
      // rule for all three target types, not just Omset.
      const dailyTarget = Number(monthlyTarget?.dailyTarget ?? outlet?.dailyTarget ?? 0);
      const insentifTarget = Number(monthlyTarget?.insentifDailyTarget ?? outlet?.insentifTarget ?? 0);
      const fullshiftTarget = Number(monthlyTarget?.fullshiftDailyTarget ?? outlet?.fullshiftTarget ?? 0);

      return {
        kind: "pramuniaga" as const,
        checkedIn: Boolean(attendance?.timeIn),
        reportStatus: sessionReport ? sessionReport.status : null,
        outletOmset,
        dailyTarget,
        insentifTarget,
        fullshiftTarget,
      };
    }

    return { kind: "generic" as const };
  } catch {
    return { kind: "db_unavailable" as const };
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const data = await loadDashboardData(user.id, user.role, user.outletId ?? null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Selamat datang, ${user.name}`}
        description={`${user.role.replace(/_/g, " ")}${user.outlet ? ` · ${user.outlet.name}` : ""}`}
      />

      {data.kind === "db_unavailable" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Database belum terhubung. Jalankan <code>prisma migrate dev</code> setelah{" "}
          <code>DATABASE_URL</code>/<code>DIRECT_URL</code> di <code>.env.local</code> terisi.
        </div>
      )}

      {data.kind === "management" && (
        <div className="space-y-3">
          {data.scoped && (
            <p className="text-xs text-slate-400">Data dipersempit ke region yang Anda kelola.</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={data.scoped ? "Outlet di Region Anda" : "Outlet Aktif"}
              value={String(data.outletCount)}
              tone="brand"
              icon={<Store className="h-4 w-4" />}
            />
            <StatCard
              label="Omset vs Target Hari Ini"
              value={
                data.totalDailyTarget > 0
                  ? `${Math.round((data.todayOmset / data.totalDailyTarget) * 100)}%`
                  : "Target belum diset"
              }
              hint={
                data.totalDailyTarget > 0
                  ? `${currency.format(data.todayOmset)} / ${currency.format(data.totalDailyTarget)}`
                  : undefined
              }
              tone={
                data.totalDailyTarget > 0 && data.todayOmset / data.totalDailyTarget >= 1
                  ? "success"
                  : data.totalDailyTarget > 0
                    ? "warning"
                    : "neutral"
              }
              icon={<Target className="h-4 w-4" />}
            />
            <StatCard
              label="Laporan Menunggu Validasi"
              value={String(data.pendingReports)}
              tone={data.pendingReports > 0 ? "warning" : "success"}
              icon={<Clock3 className="h-4 w-4" />}
            />
            <StatCard
              label="Expense Menunggu Approval"
              value={String(data.pendingExpenses)}
              tone={data.pendingExpenses > 0 ? "warning" : "success"}
              icon={<ReceiptText className="h-4 w-4" />}
            />
          </div>
          <Link href="/executive" className="inline-block text-sm font-medium text-accent-700 hover:text-accent-800">
            Lihat target &amp; pace per outlet →
          </Link>
        </div>
      )}

      {data.kind === "pramuniaga" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Status Check-in"
              value={data.checkedIn ? "Sudah Check-in" : "Belum Check-in"}
              tone={data.checkedIn ? "success" : "warning"}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              label="Laporan Hari Ini"
              value={data.reportStatus ?? "Belum submit"}
              tone={data.reportStatus ? "brand" : "warning"}
              icon={<FileText className="h-4 w-4" />}
            />
            <StatCard
              label="Omset vs Target Outlet"
              value={data.dailyTarget > 0 ? `${Math.round((data.outletOmset / data.dailyTarget) * 100)}%` : "Target belum diset"}
              hint={data.dailyTarget > 0 ? `${currency.format(data.outletOmset)} / ${currency.format(data.dailyTarget)}` : undefined}
              tone={data.dailyTarget > 0 && data.outletOmset / data.dailyTarget >= 1 ? "success" : data.dailyTarget > 0 ? "warning" : "neutral"}
              icon={<Store className="h-4 w-4" />}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard
              label="Omset vs Target Insentif"
              value={data.insentifTarget > 0 ? `${Math.round((data.outletOmset / data.insentifTarget) * 100)}%` : "Target belum diset"}
              hint={data.insentifTarget > 0 ? `${currency.format(data.outletOmset)} / ${currency.format(data.insentifTarget)}` : undefined}
              tone={data.insentifTarget > 0 && data.outletOmset / data.insentifTarget >= 1 ? "success" : data.insentifTarget > 0 ? "warning" : "neutral"}
              icon={<Zap className="h-4 w-4" />}
            />
            <StatCard
              label="Omset vs Target Fullshift"
              value={data.fullshiftTarget > 0 ? `${Math.round((data.outletOmset / data.fullshiftTarget) * 100)}%` : "Target belum diset"}
              hint={data.fullshiftTarget > 0 ? `${currency.format(data.outletOmset)} / ${currency.format(data.fullshiftTarget)}` : undefined}
              tone={data.fullshiftTarget > 0 && data.outletOmset / data.fullshiftTarget >= 1 ? "success" : data.fullshiftTarget > 0 ? "warning" : "neutral"}
              icon={<Target className="h-4 w-4" />}
            />
          </div>
        </div>
      )}
    </div>
  );
}
