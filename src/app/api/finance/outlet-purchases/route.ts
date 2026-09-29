import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { outletPurchaseSchema } from "@/lib/validations/incentive";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const outletId = searchParams.get("outletId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const purchases = await prisma.outletPurchase.findMany({
    where: {
      ...(outletId ? { outletId } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}) } }
        : {}),
    },
    include: { outlet: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 300,
  });
  return NextResponse.json({ purchases });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = outletPurchaseSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { outletId, date, description, qty, unit, amount, note } = parsed.data;
  const purchase = await prisma.outletPurchase.create({
    data: { outletId, date, description, qty, unit, amount, note, createdById: user.id },
  });
  return NextResponse.json({ success: true, id: purchase.id });
}
