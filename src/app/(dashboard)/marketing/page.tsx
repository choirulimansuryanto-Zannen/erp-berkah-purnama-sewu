import { redirect } from "next/navigation";
import type { MemberTier } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateCampaignForm } from "@/components/marketing/create-campaign-form";
import { CampaignStatusControl } from "@/components/marketing/campaign-status-control";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const STATUS_TONE = { DRAFT: "neutral", ACTIVE: "success", ENDED: "info" } as const;

async function campaignPerformance(campaign: { startDate: Date; endDate: Date; targetTier: MemberTier | null }) {
  const endInclusive = new Date(campaign.endDate);
  endInclusive.setHours(23, 59, 59, 999);

  const agg = await prisma.transaction.aggregate({
    where: {
      status: "COMPLETED",
      createdAt: { gte: campaign.startDate, lte: endInclusive },
      memberId: { not: null },
      member: campaign.targetTier ? { tier: campaign.targetTier } : undefined,
    },
    _sum: { total: true, pointsEarned: true },
    _count: true,
  });

  return {
    omset: Number(agg._sum.total ?? 0),
    pointsDistributed: agg._sum.pointsEarned ?? 0,
    transactionCount: agg._count,
  };
}

export default async function MarketingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "marketing:manage_campaigns")) redirect("/dashboard");

  const campaigns = await prisma.campaign.findMany({
    include: { createdBy: true },
    orderBy: { createdAt: "desc" },
  });

  const performance = await Promise.all(campaigns.map((c) => campaignPerformance(c)));

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing Campaigns" description="Kelola promosi loyalty dan pantau performanya." />

      <CreateCampaignForm />

      <div className="space-y-4">
        {campaigns.map((c, idx) => {
          const perf = performance[idx];
          const roiPct = c.budgetCap && Number(c.budgetCap) > 0 ? Math.round((perf.omset / Number(c.budgetCap)) * 100) : null;
          return (
            <Card key={c.id}>
              <CardHeader>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>{c.name}</CardTitle>
                    <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.startDate.toLocaleDateString("id-ID")} – {c.endDate.toLocaleDateString("id-ID")} ·{" "}
                    {c.targetTier ?? "Semua Tier"} · {Number(c.bonusMultiplier)}x poin
                    {c.discountPercent ? ` · Diskon ${Number(c.discountPercent)}%` : ""}
                  </p>
                </div>
                <CampaignStatusControl id={c.id} status={c.status} />
              </CardHeader>
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Omset (estimasi)</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{currency.format(perf.omset)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Poin Terdistribusi</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{perf.pointsDistributed.toLocaleString("id-ID")}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Transaksi Member</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{perf.transactionCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">ROI vs Budget</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{roiPct !== null ? `${roiPct}%` : "-"}</p>
                </div>
              </div>
              <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">
                Estimasi berdasarkan transaksi member (tier sasaran) dalam rentang tanggal campaign — bukan atribusi
                langsung per transaksi.
              </p>
            </Card>
          );
        })}
        {campaigns.length === 0 && (
          <Card>
            <p className="px-5 py-10 text-center text-sm text-slate-400">Belum ada campaign.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
