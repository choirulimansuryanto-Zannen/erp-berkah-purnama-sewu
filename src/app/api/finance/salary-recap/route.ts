import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { upsertSalaryRecapSchema } from "@/lib/validations/salary-recap";

// Upsert — one row per (year, month, department). Re-submitting the same
// month/department (e.g. correcting a figure) replaces it rather than
// erroring or duplicating, same convention as Persediaan's closing form.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = upsertSalaryRecapSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { year, month, department, ...values } = parsed.data;

  const row = await prisma.salaryRecap.upsert({
    where: { year_month_department: { year, month, department } },
    create: { year, month, department, ...values, recordedById: user.id },
    update: { ...values, recordedById: user.id },
  });
  return NextResponse.json({ success: true, id: row.id });
}
