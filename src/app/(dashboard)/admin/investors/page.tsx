import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { InvestorManager } from "@/components/admin/investor-manager";

// Investor list + the company-wide Sharing Profit pool rate — Laporan
// Sharing Profit reads both when it (re)calculates a month's distribution.
export default async function InvestorsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:manage_incentive_rules")) redirect("/dashboard");

  const [investors, rule] = await Promise.all([
    prisma.investor.findMany({ orderBy: { name: "asc" } }),
    prisma.sharingProfitRule.findFirst(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investor & Sharing Profit"
        description="Daftar investor, persentase kepemilikan, dan rate pool sharing profit dari Laba Bersih perusahaan."
      />
      <InvestorManager
        investors={investors.map((i) => ({ id: i.id, name: i.name, ownershipPct: Number(i.ownershipPct), status: i.status, note: i.note }))}
        sharingProfitRate={Number(rule?.rate ?? 0)}
      />
    </div>
  );
}
