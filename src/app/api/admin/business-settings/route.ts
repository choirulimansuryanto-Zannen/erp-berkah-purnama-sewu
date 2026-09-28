import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { businessSettingsSchema } from "@/lib/validations/business-settings";
import { getBusinessSettings } from "@/lib/business-settings";

export async function GET() {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const settings = await getBusinessSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = businessSettingsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.businessHourEnd <= parsed.data.businessHourStart) {
    return NextResponse.json({ error: "businessHourEnd must be after businessHourStart" }, { status: 400 });
  }
  if (parsed.data.cashVarianceSpvReview < parsed.data.cashVarianceAutoApprove) {
    return NextResponse.json(
      { error: "cashVarianceSpvReview must be greater than or equal to cashVarianceAutoApprove" },
      { status: 400 },
    );
  }
  if (parsed.data.loyaltyGoldThreshold < parsed.data.loyaltySilverThreshold) {
    return NextResponse.json(
      { error: "loyaltyGoldThreshold must be greater than or equal to loyaltySilverThreshold" },
      { status: 400 },
    );
  }
  if (parsed.data.pacingYellowThresholdPercent < parsed.data.pacingRedThresholdPercent) {
    return NextResponse.json(
      { error: "pacingYellowThresholdPercent must be greater than or equal to pacingRedThresholdPercent" },
      { status: 400 },
    );
  }

  const existing = await prisma.businessSettings.findFirst();
  const settings = existing
    ? await prisma.businessSettings.update({
        where: { id: existing.id },
        data: { ...parsed.data, updatedById: user.id },
      })
    : await prisma.businessSettings.create({ data: { ...parsed.data, updatedById: user.id } });

  return NextResponse.json({ success: true, settings });
}
