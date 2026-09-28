import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { stockAdjustmentDecisionSchema } from "@/lib/validations/inventory";
import { isOutletInScope } from "@/lib/outlet-scope";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("inventory:approve_adjustment");
  if (!user) return response!;

  const parsed = stockAdjustmentDecisionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.stockAdjustment.findUnique({ where: { id }, select: { outletId: true } });
  if (!existing) return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
  if (!(await isOutletInScope(user.id, user.role, existing.outletId))) {
    return NextResponse.json({ error: "Outlet is outside your region" }, { status: 403 });
  }

  const adjustment = await prisma.stockAdjustment.update({
    where: { id },
    data: { status: parsed.data.status, approvedById: user.id, approvedAt: new Date() },
  });

  return NextResponse.json({ success: true, status: adjustment.status });
}
