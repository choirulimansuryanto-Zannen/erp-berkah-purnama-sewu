import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { investorSchema } from "@/lib/validations/incentive";

export async function GET() {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;
  const investors = await prisma.investor.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ investors });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_incentive_rules");
  if (!user) return response!;

  const parsed = investorSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const investor = await prisma.investor.create({ data: { ...parsed.data, updatedById: user.id } });
  return NextResponse.json({ success: true, investor });
}
