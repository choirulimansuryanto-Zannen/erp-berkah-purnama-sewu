import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { outletMaterialSchema } from "@/lib/validations/incentive";

export async function GET() {
  const materials = await prisma.outletMaterial.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ materials });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = outletMaterialSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.outletMaterial.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: "Kode material sudah dipakai" }, { status: 409 });
  }

  const material = await prisma.outletMaterial.create({ data: { ...parsed.data, updatedById: user.id } });
  return NextResponse.json({ success: true, id: material.id });
}
