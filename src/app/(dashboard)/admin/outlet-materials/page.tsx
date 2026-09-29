import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { CreateOutletMaterialForm } from "@/components/admin/create-outlet-material-form";
import { OutletMaterialRow } from "@/components/admin/outlet-material-row";

const CATEGORY_LABELS: Record<string, string> = {
  BAHAN_UTAMA: "Bahan Utama",
  BAHAN_BAKU_TAMBAHAN: "Bahan Baku Tambahan",
  PACKAGING: "Packaging",
  BAHAN_ALAT_PENDUKUNG: "Bahan & Alat Pendukung",
};

// Master data for the Laporan Outlet Inventory Sheet's "Data Stock
// Available" catalog — every material an outlet tracks stock for, grouped
// into the 4 categories the source spreadsheet uses.
export default async function AdminOutletMaterialsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const materials = await prisma.outletMaterial.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  const [purchaseUsage, adjustmentUsage, closingUsage] = await Promise.all([
    prisma.outletPurchase.findMany({ distinct: ["materialId"], select: { materialId: true }, where: { materialId: { not: null } } }),
    prisma.outletAdjustment.findMany({ distinct: ["materialId"], select: { materialId: true }, where: { materialId: { not: null } } }),
    prisma.outletMaterialClosingBalance.findMany({ distinct: ["materialId"], select: { materialId: true } }),
  ]);
  const usedIds = new Set([...purchaseUsage, ...adjustmentUsage, ...closingUsage].map((r) => r.materialId).filter(Boolean));

  const byCategory = new Map<string, typeof materials>();
  for (const m of materials) byCategory.set(m.category, [...(byCategory.get(m.category) ?? []), m]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Stock Available"
        description="Kelola katalog material/bahan yang muncul di Inventory Sheet Laporan Outlet — dikelompokkan per kategori seperti pada spreadsheet asli."
      />

      <CreateOutletMaterialForm />

      {[...byCategory.entries()].map(([category, rows]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>
              {CATEGORY_LABELS[category] ?? category} ({rows.length})
            </CardTitle>
          </CardHeader>
          <Table>
            <Thead>
              <tr>
                <Th>Kode</Th>
                <Th>Nama</Th>
                <Th>Kategori</Th>
                <Th>Satuan</Th>
                <Th>Harga Satuan</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </Thead>
            <tbody>
              {rows.map((m) => (
                <OutletMaterialRow
                  key={m.id}
                  id={m.id}
                  code={m.code}
                  name={m.name}
                  category={m.category}
                  unit={m.unit}
                  unitPrice={Number(m.unitPrice)}
                  status={m.status}
                  hasUsage={usedIds.has(m.id)}
                />
              ))}
              {rows.length === 0 && <EmptyRow colSpan={7}>Belum ada material.</EmptyRow>}
            </tbody>
          </Table>
        </Card>
      ))}
      {materials.length === 0 && (
        <Card>
          <div className="p-6 text-sm text-slate-500">Belum ada material tersimpan.</div>
        </Card>
      )}
    </div>
  );
}
