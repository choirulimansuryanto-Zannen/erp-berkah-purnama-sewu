import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { runCalculationSchema } from "@/lib/validations/incentive";
import { runIncentiveCalculation } from "@/lib/incentive";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1;

  const calculations = await prisma.incentiveCalculation.findMany({
    where: { year, month },
    include: { outlet: { select: { name: true } }, region: { select: { name: true } }, rule: true },
    orderBy: [{ scope: "asc" }, { type: "asc" }],
  });
  return NextResponse.json({ calculations });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = runCalculationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const count = await runIncentiveCalculation(parsed.data.year, parsed.data.month, user.id);
  return NextResponse.json({ success: true, count });
}
