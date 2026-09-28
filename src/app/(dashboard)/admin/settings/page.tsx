import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getBusinessSettings } from "@/lib/business-settings";
import { OutletTargetRow } from "@/components/admin/outlet-target-row";
import { BusinessSettingsForm } from "@/components/admin/business-settings-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const [outlets, recentAudit, businessSettings] = await Promise.all([
    prisma.outlet.findMany({ orderBy: { name: "asc" } }),
    prisma.auditTrail.findMany({ orderBy: { timestamp: "desc" }, take: 20, include: { user: true } }),
    getBusinessSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="System Settings" description="Konfigurasi outlet, business rules, dan audit trail." />

      <BusinessSettingsForm initial={businessSettings} />

      <Card>
        <CardHeader>
          <CardTitle>Outlet Daily Targets</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Outlet</Th>
              <Th>Daily Target (Rp)</Th>
              <Th>Max Pramuniaga/Shift</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {outlets.map((o) => (
              <OutletTargetRow
                key={o.id}
                id={o.id}
                name={o.name}
                dailyTarget={Number(o.dailyTarget)}
                maxPramuniagaPerShift={o.maxPramuniagaPerShift}
              />
            ))}
            {outlets.length === 0 && <EmptyRow colSpan={4}>Belum ada outlet.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Trail Terbaru</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-slate-100">
          {recentAudit.map((a) => (
            <li key={a.id} className="px-5 py-2.5 text-sm text-slate-600">
              <span className="text-slate-400">{a.timestamp.toLocaleString()}</span> · {a.user?.name ?? "system"} ·{" "}
              <span className="font-medium text-slate-800">{a.action}</span> {a.tableName} #{a.recordId}
            </li>
          ))}
          {recentAudit.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-slate-400">Belum ada aktivitas.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
