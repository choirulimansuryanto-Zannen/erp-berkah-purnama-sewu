import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("expense:submit");
  if (!user) return response!;

  const existing = await prisma.kasbon.findUnique({ where: { id }, select: { pramuniagaId: true } });
  if (!existing) return NextResponse.json({ error: "Kasbon not found" }, { status: 404 });
  if (existing.pramuniagaId !== user.id) {
    return NextResponse.json({ error: "Bukan kasbon Anda" }, { status: 403 });
  }

  await prisma.kasbon.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
