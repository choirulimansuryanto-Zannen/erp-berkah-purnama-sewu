import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { IncentiveRuleEditor } from "@/components/admin/incentive-rule-editor";

// Fixed 10-row rate table (one per IncentiveRuleType) that Laporan
// Insentive, Laporan Outlet's Insentive Sheet, and the incentive
// calculation engine (src/lib/incentive.ts) all read from — edit a rate
// here, it applies the next time a month's incentives are (re)calculated.
export default async function IncentiveRulesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:manage_incentive_rules")) redirect("/dashboard");

  const rules = await prisma.incentiveRule.findMany({ orderBy: { type: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Insentif"
        description="Basis & rate perhitungan untuk setiap jenis insentif — dipakai saat Laporan Insentif/Laporan Outlet menghitung ulang bulan berjalan."
      />
      <Card>
        <CardHeader>
          <CardTitle>10 Jenis Insentif</CardTitle>
        </CardHeader>
        <IncentiveRuleEditor
          rules={rules.map((r) => ({ type: r.type, scope: r.scope, basis: r.basis, rate: Number(r.rate), status: r.status }))}
        />
      </Card>
    </div>
  );
}
