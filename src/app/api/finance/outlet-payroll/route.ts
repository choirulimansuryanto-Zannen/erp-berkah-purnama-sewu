import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { outletPayrollSchema } from "@/lib/validations/outlet-payroll";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const outletId = searchParams.get("outletId");
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1;

  const rows = await prisma.outletPayroll.findMany({
    where: { ...(outletId ? { outletId } : {}), year, month },
    include: { user: { select: { name: true } }, recordedBy: { select: { name: true } } },
  });
  return NextResponse.json({ rows });
}

// Upsert — one row per (outlet, user, year, month), same convention as
// InventoryClosingBalance/OutletMaterialClosingBalance: re-submitting the
// same month (correcting a figure) replaces it rather than erroring.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = outletPayrollSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { outletId, userId, year, month, laborCost, salary, totalAbsenOverride, refMultiplier, note } = parsed.data;

  const row = await prisma.outletPayroll.upsert({
    where: { outletId_userId_year_month: { outletId, userId, year, month } },
    create: { outletId, userId, year, month, laborCost, salary, totalAbsenOverride, refMultiplier, note, recordedById: user.id },
    // totalAbsenOverride/refMultiplier only overwritten when the caller
    // actually sent them — OutletPayrollInput (Absen Sheet) never sends
    // either, and must not silently reset a value the Summary Gaji &
    // Tunjangan panel already set.
    update: {
      laborCost,
      salary,
      ...(totalAbsenOverride !== undefined ? { totalAbsenOverride } : {}),
      ...(refMultiplier !== undefined ? { refMultiplier } : {}),
      note,
      recordedById: user.id,
    },
  });
  return NextResponse.json({ success: true, id: row.id });
}
