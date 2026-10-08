import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { upsertCompanyMaterialClosingSchema } from "@/lib/validations/company-material";

// Upsert — one row per (material, year, month). Re-submitting the same
// item/period replaces its figures, same convention as every other
// monthly-closing form in this app (Persediaan, Salary Recap, etc.).
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = upsertCompanyMaterialClosingSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { materialId, year, month, ...values } = parsed.data;

  const row = await prisma.companyMaterialClosingBalance.upsert({
    where: { materialId_year_month: { materialId, year, month } },
    create: { materialId, year, month, ...values, recordedById: user.id },
    update: { ...values, recordedById: user.id },
  });
  return NextResponse.json({ success: true, id: row.id });
}
