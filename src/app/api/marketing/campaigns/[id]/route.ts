import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { updateCampaignStatusSchema } from "@/lib/validations/campaigns";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("marketing:manage_campaigns");
  if (!user) return response!;

  const parsed = updateCampaignStatusSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campaign = await prisma.campaign.update({ where: { id }, data: { status: parsed.data.status } });
  return NextResponse.json({ success: true, status: campaign.status });
}
