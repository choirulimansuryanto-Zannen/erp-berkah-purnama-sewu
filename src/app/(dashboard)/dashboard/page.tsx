import Link from "next/link";
import type { Role } from "@prisma/client";
import { CheckCircle2, Clock3, FileText, ReceiptText, Store, Target, Zap, Wallet, Sparkles, Landmark, AlertTriangle, Boxes, NotebookPen } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getScopedOutletIds } from "@/lib/outlet-scope";
import { getSessionDate, getSessionTimeRange, startOfToday } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getAnnualFinancialSummary, getMonthlyAccountMatrix } from "@/lib/accounting";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const MANAGEMENT_ROLES: Role[] = ["SPV", "OFFICE", "MASTER_ADMIN"];
const INVENTORY_CATEGORIES = ["BAHAN_BAKU", "BAHAN_SETENGAH_JADI", "BARANG_JADI", "BAHAN_PENDUKUNG", "PROYEK_DALAM_PENYELESAIAN"] as const;

async function loadFaDashboardData() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const [summary, matrix, adjustingCount, closingCount] = await Promise.all([
    getAnnualFinancialSummary(year),
    getMonthlyAccountMatrix(year),
    prisma.journalEntry.count({
      where: { status: "POSTED", entryType: "JURNAL_PENYESUAIAN", date: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.inventoryClosingBalance.count({ where: { year, month } }),
  ]);

  const upToMonth = now.getMonth();
  const totalCash = matrix.filter((a) => a.cashBook).reduce((s, a) => s + a.cumulative[upToMonth], 0);
  const isBalanced = Math.abs(summary.totalAktiva - (summary.totalKewajiban + summary.totalEkuitas)) < 1;
  const stockOpnameComplete = closingCount >= INVENTORY_CATEGORIES.length;

  return {
    kind: "fa_admin" as const,
    monthLabel: now.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    labaBersihYtd: summary.labaBersih,
    totalPenjualanYtd: summary.totalPenjualan,
    totalCash,
    totalAktiva: summary.totalAktiva,
    isBalanced,
    adjustingCount,
    stockOpnameComplete,
    stockOpnameFilled: closingCount,
    stockOpnameTotal: INVENTORY_CATEGORIES.length,
  };
}

async function loadDashboardData(userId: string, role: Role, outletId: string | null) {
  try {
    if (role === "FA_ADMIN") {
      return await loadFaDashboardData();
    }

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

      {data.kind === "fa_admin" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Penjualan (YTD)" value={currency.format(data.totalPenjualanYtd)} tone="brand" icon={<Store className="h-4 w-4" />} />
            <StatCard
              label="Laba Bersih (YTD)"
              value={currency.format(data.labaBersihYtd)}
              tone={data.labaBersihYtd >= 0 ? "success" : "danger"}
              icon={<Sparkles className="h-4 w-4" />}
            />
            <StatCard label="Kas & Bank Saat Ini" value={currency.format(data.totalCash)} tone="accent" icon={<Wallet className="h-4 w-4" />} />
            <StatCard
              label="Status Neraca"
              value={data.isBalanced ? "Seimbang" : "Tidak Seimbang"}
              hint={currency.format(data.totalAktiva) + " Total Aktiva"}
              tone={data.isBalanced ? "success" : "danger"}
              icon={<Landmark className="h-4 w-4" />}
            />
          </div>

          {!data.stockOpnameComplete && (
            <Link
              href="/finance/persediaan"
              className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 transition-colors hover:bg-amber-100"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Persediaan Akhir {data.monthLabel} baru terisi {data.stockOpnameFilled}/{data.stockOpnameTotal} kategori — lengkapi di menu Persediaan
                agar Laporan HPP bulan ini akurat.
              </span>
            </Link>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-4 text-sm text-slate-600 shadow-[var(--shadow-card)]">
              <NotebookPen className="h-4 w-4 shrink-0 text-accent-600" />
              {data.adjustingCount} Jurnal Penyesuaian diposting bulan {data.monthLabel}
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-4 text-sm text-slate-600 shadow-[var(--shadow-card)]">
              <Boxes className="h-4 w-4 shrink-0 text-accent-600" />
              {data.stockOpnameFilled}/{data.stockOpnameTotal} kategori Persediaan Akhir sudah tercatat bulan {data.monthLabel}
            </div>
          </div>

          <Link href="/executive" className="inline-block text-sm font-medium text-accent-700 hover:text-accent-800">
            Lihat FA Executive Dashboard lengkap →
          </Link>
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
