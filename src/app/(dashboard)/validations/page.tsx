import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getScopedOutletIds } from "@/lib/outlet-scope";
import { DecisionButtons } from "@/components/validations/decision-buttons";
import { PendingReportList } from "@/components/validations/pending-report-list";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function SectionCard({
  title,
  count,
  id,
  children,
}: {
  title: string;
  count: number;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{title}</CardTitle>
          {count > 0 && <Badge tone="warning">{count} pending</Badge>}
        </div>
      </CardHeader>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </Card>
  );
}

export default async function ValidationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canValidateReports = can(user.role, "report:validate");
  const canApproveExpenses = can(user.role, "expense:approve");
  const canApproveInventory = can(user.role, "inventory:approve_adjustment");
  const canApproveLeave = can(user.role, "attendance:approve_leave");

  const scopedOutletIds = await getScopedOutletIds(user.id, user.role);
  const outletFilter = scopedOutletIds ? { in: scopedOutletIds } : undefined;

  const [reports, expenses, adjustments, leaves] = await Promise.all([
    canValidateReports
      ? prisma.dailyReport.findMany({
          where: { status: "PENDING", ...(outletFilter ? { outletId: outletFilter } : {}) },
          include: { outlet: true, pramuniaga: true },
        })
      : Promise.resolve([]),
    canApproveExpenses
      ? prisma.expenseRecord.findMany({
          where: { approvalStatus: "PENDING", ...(outletFilter ? { outletId: outletFilter } : {}) },
          include: { outlet: true, submitter: true, categoryDef: true },
        })
      : Promise.resolve([]),
    canApproveInventory
      ? prisma.stockAdjustment.findMany({
          where: { status: "PENDING", ...(outletFilter ? { outletId: outletFilter } : {}) },
          include: { outlet: true, product: true, requester: true },
        })
      : Promise.resolve([]),
    canApproveLeave
      ? prisma.leavePermission.findMany({
          where: { status: "PENDING", ...(outletFilter ? { user: { outletId: outletFilter } } : {}) },
          include: { user: true },
        })
      : Promise.resolve([]),
  ]);

  const nothingToShow = !canValidateReports && !canApproveExpenses && !canApproveInventory && !canApproveLeave;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Validations"
        description={
          scopedOutletIds
            ? "Persetujuan yang menunggu tindakan Anda, dipersempit ke outlet di region Anda."
            : "Semua persetujuan yang menunggu tindakan Anda."
        }
      />

      {nothingToShow && <p className="text-sm text-slate-500">Tidak ada approval untuk role ini.</p>}

      {canValidateReports && (
        <SectionCard title="Daily Reports" count={reports.length} id="laporan">
          <PendingReportList
            reports={reports.map((r) => ({
              id: r.id,
              outletName: r.outlet.name,
              pramuniagaName: r.pramuniaga.name,
              dateLabel: r.date.toLocaleDateString("id-ID"),
              variance: Number(r.variance),
              varianceStatus: r.varianceStatus,
            }))}
          />
        </SectionCard>
      )}

      {canApproveExpenses && (
        <SectionCard title="Expenses" count={expenses.length}>
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
              <span className="text-slate-700">
                <span className="font-medium text-slate-900">{e.outlet.name}</span> · {e.submitter.name} ·{" "}
                {e.categoryDef.label} · {currency.format(Number(e.amount))}
              </span>
              <DecisionButtons endpoint={`/api/expenses/${e.id}/decision`} />
            </li>
          ))}
          {expenses.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">Tidak ada.</li>
          )}
        </SectionCard>
      )}

      {canApproveInventory && (
        <SectionCard title="Stock Adjustments" count={adjustments.length}>
          {adjustments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
              <span className="text-slate-700">
                <span className="font-medium text-slate-900">{a.outlet.name}</span> · {a.requester.name} ·{" "}
                {a.product.name} · {a.qtyChange > 0 ? "+" : ""}
                {a.qtyChange} · {a.reason}
              </span>
              <DecisionButtons endpoint={`/api/inventory/stock-adjustment/${a.id}/decision`} />
            </li>
          ))}
          {adjustments.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">Tidak ada.</li>
          )}
        </SectionCard>
      )}

      {canApproveLeave && (
        <SectionCard title="Leave Requests" count={leaves.length} id="izin">
          {leaves.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
              <span className="text-slate-700">
                <span className="font-medium text-slate-900">{l.user.name}</span> · {l.type} ·{" "}
                {l.dateFrom.toLocaleDateString()} - {l.dateTo.toLocaleDateString()} · {l.reason}
              </span>
              <DecisionButtons endpoint={`/api/attendance/leave/${l.id}/decision`} />
            </li>
          ))}
          {leaves.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-slate-400">Tidak ada.</li>
          )}
        </SectionCard>
      )}
    </div>
  );
}
