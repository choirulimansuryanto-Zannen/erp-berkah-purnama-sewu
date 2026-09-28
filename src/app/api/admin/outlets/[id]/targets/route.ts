import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { upsertOutletMonthlyTargetSchema } from "@/lib/validations/outlet-targets";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();

  const targets = await prisma.outletMonthlyTarget.findMany({
    where: { outletId: id, year },
    orderBy: { month: "asc" },
  });

  return NextResponse.json({ year, targets });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = upsertOutletMonthlyTargetSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { year, month, monthlyTarget, dailyTarget, insentifMonthlyTarget, insentifDailyTarget, fullshiftDailyTarget } = parsed.data;

  const target = await prisma.outletMonthlyTarget.upsert({
    where: { outletId_year_month: { outletId: id, year, month } },
    create: { outletId: id, year, month, monthlyTarget, dailyTarget, insentifMonthlyTarget, insentifDailyTarget, fullshiftDailyTarget },
    update: { monthlyTarget, dailyTarget, insentifMonthlyTarget, insentifDailyTarget, fullshiftDailyTarget },
  });

  return NextResponse.json({ success: true, target });
}
