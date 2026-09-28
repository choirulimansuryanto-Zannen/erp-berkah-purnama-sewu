import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { updateExpenseCategorySchema } from "@/lib/validations/expenses";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = updateExpenseCategorySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const category = await prisma.expenseCategoryDef.update({
    where: { id },
    data: { ...parsed.data, updatedById: user.id },
  });
  return NextResponse.json({ success: true, category });
}

// Hard-delete only if never referenced by an actual expense entry —
// otherwise point at INACTIVE status instead, same convention as
// Product/Topping deletion.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const category = await prisma.expenseCategoryDef.findUnique({ where: { id } });
  if (!category) return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });

  const usageCount = await prisma.expenseRecord.count({ where: { category: category.key } });
  if (usageCount > 0) {
    return NextResponse.json(
      { error: "Kategori ini sudah pernah dipakai — nonaktifkan (status INACTIVE) alih-alih menghapus." },
      { status: 409 },
    );
  }

  await prisma.expenseCategoryDef.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
