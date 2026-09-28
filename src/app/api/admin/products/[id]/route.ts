import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["ALACARTE", "PAKET_ONLINE", "PAKET_MBG", "PAKET_KOPDES", "PAKET_PAHLAWAN"]).optional(),
  price: z.number().positive().optional(),
  cost: z.number().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SEASONAL"]).optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = updateProductSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const product = await prisma.product.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, product });
}

// Only safe to hard-delete a product that's never been sold — anything
// referenced by a real transaction stays retirable only via INACTIVE status
// (the PUT above), never actually removed, so historical sales data is
// never at risk of a broken foreign key or silent cascade loss.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const usageCount = await prisma.transactionItem.count({ where: { productId: id } });
  if (usageCount > 0) {
    return NextResponse.json(
      { error: "Produk ini sudah pernah terjual — nonaktifkan (status INACTIVE) alih-alih menghapus." },
      { status: 409 },
    );
  }

  try {
    await prisma.product.delete({ where: { id } });
  } catch {
    // Any other reference (inventory records, warehouse stock, a voucher
    // reward, ...) trips the same FK-restrict guard — same fallback advice.
    return NextResponse.json(
      { error: "Produk ini masih direferensikan data lain — nonaktifkan (status INACTIVE) alih-alih menghapus." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
