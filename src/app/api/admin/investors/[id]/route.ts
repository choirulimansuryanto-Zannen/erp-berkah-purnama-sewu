import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { investorSchema } from "@/lib/validations/incentive";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("finance:manage_incentive_rules");
  if (!user) return response!;

  const parsed = investorSchema.partial().safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const investor = await prisma.investor.update({ where: { id }, data: { ...parsed.data, updatedById: user.id } });
  return NextResponse.json({ success: true, investor });
}

// Investors already referenced by a SharingProfitDistribution are
// deactivated (INACTIVE), never deleted — matches the Chart of Accounts
// guard: history/audit trail (what was distributed and to whom) must
// never be able to silently disappear.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("finance:manage_incentive_rules");
  if (!user) return response!;

  const distributionCount = await prisma.sharingProfitDistribution.count({ where: { investorId: id } });
  if (distributionCount > 0) {
    await prisma.investor.update({ where: { id }, data: { status: "INACTIVE", updatedById: user.id } });
    return NextResponse.json({ success: true, deactivated: true });
  }
  await prisma.investor.delete({ where: { id } });
  return NextResponse.json({ success: true, deactivated: false });
}
