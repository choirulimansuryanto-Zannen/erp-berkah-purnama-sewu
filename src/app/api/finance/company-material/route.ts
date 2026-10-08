import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { upsertCompanyMaterialClosingSchema } from "@/lib/validations/company-material";

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

// Lets the entry form load the current saved figures (or sensible
// defaults) whenever Item/Period changes, so re-submitting doesn't
// silently zero out fields the user didn't mean to touch.
export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const materialId = searchParams.get("materialId");
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!materialId || !year || !month) {
    return NextResponse.json({ error: "materialId, year, month required" }, { status: 400 });
  }

  const current = await prisma.companyMaterialClosingBalance.findUnique({
    where: { materialId_year_month: { materialId, year, month } },
  });
  if (current) {
    return NextResponse.json({
      saldoAwalQty: Number(current.saldoAwalQty),
      qtyOpname: Number(current.qtyOpname),
      costPerUnit: Number(current.costPerUnit),
      fakturOutletQty: Number(current.fakturOutletQty),
      totalBahanBakuQty: Number(current.totalBahanBakuQty),
    });
  }

  // No record yet for this period — default Saldo Awal to the prior
  // month's Saldo Akhir (the usual rollover), everything else starts at 0.
  const prev = prevMonth(year, month);
  const prevRow = await prisma.companyMaterialClosingBalance.findUnique({
    where: { materialId_year_month: { materialId, year: prev.year, month: prev.month } },
  });
  return NextResponse.json({
    saldoAwalQty: prevRow ? Number(prevRow.qtyOpname) : 0,
    qtyOpname: 0,
    costPerUnit: prevRow ? Number(prevRow.costPerUnit) : 0,
    fakturOutletQty: 0,
    totalBahanBakuQty: 0,
  });
}

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
