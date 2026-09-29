import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { incentiveBracketSchema } from "@/lib/validations/incentive";

export async function GET() {
  const brackets = await prisma.incentiveBracket.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ brackets });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = incentiveBracketSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bracket = await prisma.incentiveBracket.create({ data: { ...parsed.data, updatedById: user.id } });
  return NextResponse.json({ success: true, id: bracket.id });
}
