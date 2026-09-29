import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { outletMaterialClosingBalanceSchema } from "@/lib/validations/incentive";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const outletId = searchParams.get("outletId");
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1;

  const rows = await prisma.outletMaterialClosingBalance.findMany({
    where: { ...(outletId ? { outletId } : {}), year, month },
    include: { material: { select: { code: true, name: true, unit: true } }, recordedBy: { select: { name: true } } },
    orderBy: { material: { sortOrder: "asc" } },
  });
  return NextResponse.json({ rows });
}

// Upsert — one row per (outlet, material, year, month), the same
// stock-opname convention as InventoryClosingBalance: re-submitting the
// same month (correcting a typo) replaces the figure rather than erroring.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = outletMaterialClosingBalanceSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { outletId, materialId, year, month, qty, note } = parsed.data;

  const row = await prisma.outletMaterialClosingBalance.upsert({
    where: { outletId_materialId_year_month: { outletId, materialId, year, month } },
    create: { outletId, materialId, year, month, qty, note, recordedById: user.id },
    update: { qty, note, recordedById: user.id },
  });
  return NextResponse.json({ success: true, id: row.id });
}
