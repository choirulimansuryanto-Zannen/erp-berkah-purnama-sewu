import { NextResponse } from "next/server";
import { requirePermission, requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { stockAdjustmentSchema } from "@/lib/validations/inventory";
import { can } from "@/lib/permissions";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const adjustments = await prisma.stockAdjustment.findMany({
    where: can(user.role, "inventory:approve_adjustment")
      ? { status: "PENDING" }
      : { requestedById: user.id },
    include: { outlet: true, product: true, requester: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ adjustments });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("inventory:record_check");
  if (!user || !user.outletId) return response!;

  const parsed = stockAdjustmentSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const adjustment = await prisma.stockAdjustment.create({
    data: { outletId: user.outletId, requestedById: user.id, ...parsed.data },
  });

  return NextResponse.json({ success: true, approval_needed: true, id: adjustment.id });
}
