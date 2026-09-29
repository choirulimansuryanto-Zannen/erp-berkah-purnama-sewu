import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { sharingProfitRuleSchema } from "@/lib/validations/incentive";

export async function GET() {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;
  const rule = await prisma.sharingProfitRule.findFirst();
  return NextResponse.json({ rule });
}

// Singleton — always updates the one existing row (creating it if this is
// somehow the very first call, though the seed already guarantees one).
export async function PUT(request: Request) {
  const { user, response } = await requirePermission("finance:manage_incentive_rules");
  if (!user) return response!;

  const parsed = sharingProfitRuleSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.sharingProfitRule.findFirst();
  const rule = existing
    ? await prisma.sharingProfitRule.update({ where: { id: existing.id }, data: { rate: parsed.data.rate, updatedById: user.id } })
    : await prisma.sharingProfitRule.create({ data: { rate: parsed.data.rate, updatedById: user.id } });
  return NextResponse.json({ success: true, rule });
}
