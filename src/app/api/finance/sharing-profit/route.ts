import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { runCalculationSchema } from "@/lib/validations/incentive";
import { runSharingProfitCalculation } from "@/lib/incentive";

export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const month = Number(searchParams.get("month")) || new Date().getMonth() + 1;

  const distributions = await prisma.sharingProfitDistribution.findMany({
    where: { year, month },
    include: { investor: true },
    orderBy: { investor: { name: "asc" } },
  });
  return NextResponse.json({ distributions });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("finance:manage_journal");
  if (!user) return response!;

  const parsed = runCalculationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const count = await runSharingProfitCalculation(parsed.data.year, parsed.data.month, user.id);
  return NextResponse.json({ success: true, count });
}
