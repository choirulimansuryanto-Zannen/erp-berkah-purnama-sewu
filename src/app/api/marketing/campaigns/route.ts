import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { createCampaignSchema } from "@/lib/validations/campaigns";

export async function GET() {
  const { user, response } = await requirePermission("marketing:manage_campaigns");
  if (!user) return response!;

  const campaigns = await prisma.campaign.findMany({
    include: { createdBy: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("marketing:manage_campaigns");
  if (!user) return response!;

  const parsed = createCampaignSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.endDate < parsed.data.startDate) {
    return NextResponse.json({ error: "endDate must not be before startDate" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: { ...parsed.data, createdById: user.id },
  });

  return NextResponse.json({ success: true, campaign_id: campaign.id });
}
