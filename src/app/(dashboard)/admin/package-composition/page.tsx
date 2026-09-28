import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { PackageCompositionEditor } from "@/components/admin/package-composition-editor";

const PAKET_CATEGORIES = ["PAKET_ONLINE", "PAKET_MBG", "PAKET_KOPDES", "PAKET_PAHLAWAN"] as const;

export default async function AdminPackageCompositionPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const [packages, alacarteProducts, toppings, allComponents] = await Promise.all([
    prisma.product.findMany({
      where: { category: { in: [...PAKET_CATEGORIES] }, status: "ACTIVE" },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.product.findMany({ where: { category: "ALACARTE", status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }),
    prisma.topping.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.packageComponent.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const compositionByPackageId: Record<string, { componentProductId?: string; componentToppingId?: string; qty: number }[]> = {};
  for (const c of allComponents) {
    const list = compositionByPackageId[c.packageProductId] ?? [];
    list.push({
      componentProductId: c.componentProductId ?? undefined,
      componentToppingId: c.componentToppingId ?? undefined,
      qty: c.qty,
    });
    compositionByPackageId[c.packageProductId] = list;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Isi Paket (Package Composition)"
        description="Kelola isi/komposisi setiap paket (Kopdes, MBG, Trio, Mampir, Pahlawan) — tampil di POS dan dipakai untuk hitung Terjual (sistem) di Daily Report."
      />
      <PackageCompositionEditor
        packages={packages.map((p) => ({ id: p.id, name: p.name, category: p.category }))}
        candidateProducts={alacarteProducts.map((p) => ({ id: p.id, name: p.name }))}
        candidateToppings={toppings.map((t) => ({ id: t.id, name: t.name }))}
        compositionByPackageId={compositionByPackageId}
      />
    </div>
  );
}
