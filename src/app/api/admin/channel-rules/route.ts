import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { channelRulesSchema } from "@/lib/validations/channel-rules";

export async function GET() {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const rules = await prisma.categoryChannelRule.findMany({ orderBy: { category: "asc" } });
  return NextResponse.json({ rules });
}

// Bulk upsert — the admin UI always shows and saves the full 5-category
// grid at once, so one PUT replacing all rows is simpler than per-category
// routes for a fixed, small set of categories.
export async function PUT(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = channelRulesSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  for (const rule of parsed.data.rules) {
    await prisma.categoryChannelRule.upsert({
      where: { category: rule.category },
      update: { allowedChannels: rule.allowedChannels, updatedById: user.id },
      create: { category: rule.category, allowedChannels: rule.allowedChannels, updatedById: user.id },
    });
  }

  return NextResponse.json({ success: true });
}
