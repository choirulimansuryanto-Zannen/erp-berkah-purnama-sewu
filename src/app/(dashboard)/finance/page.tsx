import { redirect } from "next/navigation";
import { Banknote, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { toDateOnlyKey } from "@/lib/session";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function BreakdownBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "accent" | "brand" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <li className="px-5 py-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{currency.format(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${tone === "accent" ? "bg-accent-500" : "bg-brand-700"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  // ExpenseRecord.date is a @db.Date column — compared against a date-only
  // key, not the local-midnight instant used for Transaction.createdAt.
  const monthStartKey = toDateOnlyKey(monthStart);

  const [omsetAgg, channelBreakdown, expenseByCategory, cogsAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: monthStart } },
      _sum: { total: true },
    }),
    prisma.transaction.groupBy({
      by: ["channel"],
      where: { status: "COMPLETED", createdAt: { gte: monthStart } },
      _sum: { total: true },
    }),
    prisma.expenseRecord.groupBy({
      by: ["category"],
      where: { approvalStatus: "APPROVED", date: { gte: monthStartKey } },
      _sum: { amount: true },
    }),
    prisma.transactionItem.findMany({
      where: { transaction: { status: "COMPLETED", createdAt: { gte: monthStart } } },
      include: { product: true },
    }),
  ]);

  const monthOmset = Number(omsetAgg._sum.total ?? 0);
  const totalExpenses = expenseByCategory.reduce((sum, e) => sum + Number(e._sum.amount ?? 0), 0);
  const cogs = cogsAgg.reduce((sum, item) => sum + Number(item.product.cost) * item.qty, 0);
  const grossMargin = monthOmset - cogs;
  const netMargin = grossMargin - totalExpenses;

  const maxChannel = Math.max(...channelBreakdown.map((c) => Number(c._sum.total ?? 0)), 1);
  const maxExpense = Math.max(...expenseByCategory.map((e) => Number(e._sum.amount ?? 0)), 1);

  const csvRows = [
    { Section: "Summary", Item: "Omset (MTD)", Amount: monthOmset },
    { Section: "Summary", Item: "COGS (MTD)", Amount: cogs },
    { Section: "Summary", Item: "Gross Margin", Amount: grossMargin },
    { Section: "Summary", Item: "Net Margin", Amount: netMargin },
    ...channelBreakdown.map((c) => ({ Section: "Channel Mix", Item: c.channel, Amount: Number(c._sum.total ?? 0) })),
    ...expenseByCategory.map((e) => ({ Section: "Expenses", Item: e.category, Amount: Number(e._sum.amount ?? 0) })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company-wide Financial Dashboard"
        description="Ringkasan keuangan bulan berjalan (month-to-date)."
        actions={<ExportCsvButton rows={csvRows} filename="financial-summary.csv" />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Omset (MTD)" value={currency.format(monthOmset)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="COGS (MTD)" value={currency.format(cogs)} tone="neutral" icon={<Banknote className="h-4 w-4" />} />
        <StatCard
          label="Gross Margin"
          value={currency.format(grossMargin)}
          tone={grossMargin >= 0 ? "success" : "danger"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Net Margin"
          value={currency.format(netMargin)}
          tone={netMargin >= 0 ? "success" : "danger"}
          icon={<PiggyBank className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Channel Mix (MTD)</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-slate-100">
            {channelBreakdown.map((c) => (
              <BreakdownBar key={c.channel} label={c.channel} value={Number(c._sum.total ?? 0)} max={maxChannel} tone="accent" />
            ))}
            {channelBreakdown.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-slate-400">Belum ada transaksi bulan ini.</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category (MTD)</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-slate-100">
            {expenseByCategory.map((e) => (
              <BreakdownBar key={e.category} label={e.category} value={Number(e._sum.amount ?? 0)} max={maxExpense} tone="brand" />
            ))}
            {expenseByCategory.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-slate-400">Belum ada expense bulan ini.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
