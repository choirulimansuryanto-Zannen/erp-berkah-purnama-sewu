import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { packageCompositionSchema } from "@/lib/validations/package-composition";

// Wholesale replace — the admin form always submits the full current
// composition, not a diff, so delete-then-recreate is simplest and can't
// leave a stale row behind from a component that got zeroed out.
export async function PUT(request: Request, { params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const { user, response } = await requirePermission("admin:system_config");
  if (!user) return response!;

  const parsed = packageCompositionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const packageProduct = await prisma.product.findUnique({ where: { id: packageId } });
  if (!packageProduct) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });

  for (const c of parsed.data.components) {
    if (Boolean(c.componentProductId) === Boolean(c.componentToppingId)) {
      return NextResponse.json(
        { error: "Setiap komponen harus berupa produk ATAU topping, tidak keduanya/kosong" },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.packageComponent.deleteMany({ where: { packageProductId: packageId } });
    if (parsed.data.components.length > 0) {
      await tx.packageComponent.createMany({
        data: parsed.data.components.map((c, i) => ({
          packageProductId: packageId,
          componentProductId: c.componentProductId,
          componentToppingId: c.componentToppingId,
          qty: c.qty,
          sortOrder: i,
        })),
      });
    }
  });

  return NextResponse.json({ success: true });
}
