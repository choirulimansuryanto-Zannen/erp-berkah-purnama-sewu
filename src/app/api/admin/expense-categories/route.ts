import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { expenseCategorySchema } from "@/lib/validations/expenses";

export async function GET() {
  const categories = await prisma.expenseCategoryDef.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = expenseCategorySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.expenseCategoryDef.findUnique({ where: { key: parsed.data.key } });
  if (existing) {
    return NextResponse.json({ error: "Key kategori sudah dipakai" }, { status: 409 });
  }

  const category = await prisma.expenseCategoryDef.create({
    data: { ...parsed.data, updatedById: user.id },
  });
  return NextResponse.json({ category_id: category.id, success: true });
}
