import { NextResponse } from "next/server";
import { requirePermission, requireUser } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { submitExpenseSchema } from "@/lib/validations/expenses";
import { can } from "@/lib/permissions";
import { getSessionDate } from "@/lib/session";
import { resolveEditableReportDate } from "@/lib/report-edit";
import { getBusinessSettings } from "@/lib/business-settings";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const expenses = await prisma.expenseRecord.findMany({
    where: can(user.role, "expense:approve")
      ? { approvalStatus: "PENDING" }
      : { submittedById: user.id },
    include: { outlet: true, submitter: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("expense:submit");
  if (!user || !user.outletId) return response!;

  const parsed = submitExpenseSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const categoryDef = await prisma.expenseCategoryDef.findUnique({ where: { key: parsed.data.category } });
  if (!categoryDef || categoryDef.status !== "ACTIVE") {
    return NextResponse.json({ error: "Kategori tidak valid atau sudah tidak aktif" }, { status: 400 });
  }

  const settings = await getBusinessSettings();
  const autoApproved = parsed.data.amount < settings.expenseAutoApproveLimit;

  // Default to the pramuniaga's open-session date (not the current calendar
  // day) so an expense logged after midnight still lands in the same shift's
  // report instead of tomorrow's.
  const expenseDate =
    (await resolveEditableReportDate(user.outletId, user.id, parsed.data.date ?? null)) ?? (await getSessionDate(user.id));

  const expense = await prisma.expenseRecord.create({
    data: {
      outletId: user.outletId,
      category: parsed.data.category,
      amount: parsed.data.amount,
      description: parsed.data.description,
      receiptUrl: parsed.data.receiptUrl,
      date: expenseDate,
      submittedById: user.id,
      approvalStatus: autoApproved ? "APPROVED" : "PENDING",
    },
  });

  return NextResponse.json({ expense_id: expense.id, status: expense.approvalStatus });
}
