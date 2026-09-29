import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { incentiveRuleUpdateSchema } from "@/lib/validations/incentive";

export async function GET() {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;
  const rules = await prisma.incentiveRule.findMany({ orderBy: { type: "asc" } });
  return NextResponse.json({ rules });
}

// Fixed set of 10 types (the enum) — this is a settings table, not a
// growable list, so there's no create/delete, only editing an existing
// row's basis/rate/status.
export async function PUT(request: Request) {
  const { user, response } = await requirePermission("finance:manage_incentive_rules");
  if (!user) return response!;

  const parsed = incentiveRuleUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { type, basis, rate, status } = parsed.data;

  const rule = await prisma.incentiveRule.update({
    where: { type },
    data: { basis, rate, status, updatedById: user.id },
  });
  return NextResponse.json({ success: true, rule });
}
