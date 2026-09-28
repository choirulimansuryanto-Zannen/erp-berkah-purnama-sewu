import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { expenseDecisionSchema } from "@/lib/validations/expenses";
import { isOutletInScope } from "@/lib/outlet-scope";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("expense:approve");
  if (!user) return response!;

  const parsed = expenseDecisionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.expenseRecord.findUnique({ where: { id }, select: { outletId: true } });
  if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  if (!(await isOutletInScope(user.id, user.role, existing.outletId))) {
    return NextResponse.json({ error: "Outlet is outside your region" }, { status: 403 });
  }

  const expense = await prisma.expenseRecord.update({
    where: { id },
    data: { approvalStatus: parsed.data.status, approvedById: user.id },
  });

  return NextResponse.json({ success: true, status: expense.approvalStatus });
}
