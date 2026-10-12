import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { outletMonthlyBenefitSchema } from "@/lib/validations/outlet-payroll";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const outletId = searchParams.get("outletId");
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1;
  if (!outletId) return NextResponse.json({ error: "outletId required" }, { status: 400 });

  const row = await prisma.outletMonthlyBenefit.findUnique({ where: { outletId_year_month: { outletId, year, month } } });
  return NextResponse.json({
    tunjanganOutlet: Number(row?.tunjanganOutlet ?? 0),
    gajiPengelola: Number(row?.gajiPengelola ?? 0),
    fullshiftAmount: Number(row?.fullshiftAmount ?? 0),
    insentiveOperatorAmount: Number(row?.insentiveOperatorAmount ?? 0),
  });
}

// Upsert — one row per (outlet, year, month), same convention as
// OutletPayroll: re-submitting the same month replaces the figures.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = outletMonthlyBenefitSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { outletId, year, month, ...values } = parsed.data;

  const row = await prisma.outletMonthlyBenefit.upsert({
    where: { outletId_year_month: { outletId, year, month } },
    create: { outletId, year, month, ...values, recordedById: user.id },
    update: { ...values, recordedById: user.id },
  });
  return NextResponse.json({ success: true, id: row.id });
}
