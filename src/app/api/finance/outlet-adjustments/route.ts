import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { outletAdjustmentSchema } from "@/lib/validations/incentive";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const outletId = searchParams.get("outletId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const rows = await prisma.outletAdjustment.findMany({
    where: {
      ...(outletId ? { outletId } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}) } }
        : {}),
    },
    include: { outlet: { select: { name: true } }, material: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 300,
  });
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = outletAdjustmentSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { outletId, date, type, materialId, description, qty, amount, note } = parsed.data;
  const row = await prisma.outletAdjustment.create({
    data: { outletId, date, type, materialId, description, qty, amount, note, createdById: user.id },
  });
  return NextResponse.json({ success: true, id: row.id });
}
