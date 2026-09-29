import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { updateIncentiveBracketSchema } from "@/lib/validations/incentive";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = updateIncentiveBracketSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bracket = await prisma.incentiveBracket.update({ where: { id }, data: { ...parsed.data, updatedById: user.id } });
  return NextResponse.json({ success: true, bracket });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const bracket = await prisma.incentiveBracket.findUnique({ where: { id } });
  if (!bracket) return NextResponse.json({ error: "Bracket tidak ditemukan" }, { status: 404 });

  await prisma.incentiveBracket.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
