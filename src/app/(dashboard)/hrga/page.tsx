import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { DEFAULT_ATTENDANCE_POLICY } from "@/lib/policy";
import { toDateOnlyKey } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PolicyForm } from "@/components/hrga/policy-form";

const COMPLIANCE_WINDOW_DAYS = 30;

export default async function HrgaPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "hrga:manage_policy")) redirect("/dashboard");

  const policy = (await prisma.attendancePolicy.findFirst()) ?? DEFAULT_ATTENDANCE_POLICY;

  const windowStart = toDateOnlyKey(new Date());
  windowStart.setUTCDate(windowStart.getUTCDate() - COMPLIANCE_WINDOW_DAYS);

  const [staff, records] = await Promise.all([
    prisma.user.findMany({ where: { outletId: { not: null }, status: "ACTIVE" }, include: { outlet: true } }),
    prisma.attendanceRecord.groupBy({
      by: ["userId", "status"],
      where: { date: { gte: windowStart } },
      _count: true,
    }),
  ]);

  const statsByUser = new Map<string, { present: number; late: number; total: number }>();
  for (const r of records) {
    const entry = statsByUser.get(r.userId) ?? { present: 0, late: 0, total: 0 };
    if (r.status === "PRESENT") entry.present += r._count;
    if (r.status === "LATE") entry.late += r._count;
    entry.total += r._count;
    statsByUser.set(r.userId, entry);
  }

  const rows = staff
    .map((s) => {
      const stat = statsByUser.get(s.id) ?? { present: 0, late: 0, total: 0 };
      const complianceRate = Math.round((stat.total / COMPLIANCE_WINDOW_DAYS) * 100);
      const onTimeRate = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;
      return { ...s, ...stat, complianceRate, onTimeRate };
    })
    .sort((a, b) => a.complianceRate - b.complianceRate);

  return (
    <div className="space-y-6">
      <PageHeader title="HRGA — Attendance Policy & Compliance" description="Konfigurasi kebijakan absensi dan pantau kepatuhan tim." />

      <PolicyForm initial={policy} />

      <Card>
        <CardHeader>
          <CardTitle>Compliance Scorecard ({COMPLIANCE_WINDOW_DAYS} hari terakhir)</CardTitle>
        </CardHeader>
        <p className="px-5 pb-2 text-xs text-slate-400">
          Check-in rate = hari dengan check-in / {COMPLIANCE_WINDOW_DAYS} hari kalender. Sistem belum memiliki job
          otomatis untuk menandai hari tanpa check-in sebagai &ldquo;absen&rdquo; — metrik ini murni dari check-in yang tercatat.
        </p>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th>Outlet</Th>
              <Th>Check-in Rate</Th>
              <Th>On-time Rate</Th>
              <Th>Terlambat</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-slate-900">{r.name}</Td>
                <Td>{r.outlet?.name ?? "-"}</Td>
                <Td>
                  <Badge tone={r.complianceRate >= 85 ? "success" : r.complianceRate >= 60 ? "warning" : "danger"}>
                    {r.complianceRate}%
                  </Badge>
                </Td>
                <Td>{r.onTimeRate}%</Td>
                <Td>{r.late}</Td>
              </Tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5}>Belum ada staf outlet.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
