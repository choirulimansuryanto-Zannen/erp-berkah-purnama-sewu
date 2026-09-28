import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { inventoryClosingBalanceSchema } from "@/lib/validations/accounting";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();

  const rows = await prisma.inventoryClosingBalance.findMany({
    where: { OR: [{ year }, { year: year - 1, month: 12 }] },
    include: { recordedBy: { select: { name: true } } },
    orderBy: [{ year: "asc" }, { month: "asc" }, { category: "asc" }],
  });
  return NextResponse.json({ rows });
}

// Upsert — one row per (year, month, category). FA Admin re-submitting the
// same month/category (e.g. correcting a stock-opname typo) replaces the
// figure rather than erroring or duplicating.
export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = inventoryClosingBalanceSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { year, month, category, amount, note } = parsed.data;

  const row = await prisma.inventoryClosingBalance.upsert({
    where: { year_month_category: { year, month, category } },
    create: { year, month, category, amount, note, recordedById: user.id },
    update: { amount, note, recordedById: user.id },
  });
  return NextResponse.json({ success: true, id: row.id });
}
