import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { CreateFreezerMaterialForm } from "@/components/admin/create-freezer-material-form";
import { FreezerMaterialRow } from "@/components/admin/freezer-material-row";

export default async function FreezerMaterialsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const materials = await prisma.freezerMaterial.findMany({ orderBy: { sortOrder: "asc" } });
  const nextSortOrder = materials.reduce((max, m) => Math.max(max, m.sortOrder), 0) + 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bahan Baku Freezer"
        description="Katalog item Stock Freezer (nama, satuan, urutan, batas Tipis) — dipakai di menu Stock Freezer setiap outlet."
      />

      <CreateFreezerMaterialForm nextSortOrder={nextSortOrder} />

      <Card>
        <CardHeader>
          <CardTitle>Semua Item ({materials.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama Barang</Th>
              <Th>Satuan</Th>
              <Th>Urutan</Th>
              <Th>Batas Tipis</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {materials.map((m) => (
              <FreezerMaterialRow
                key={m.id}
                id={m.id}
                name={m.name}
                unit={m.unit}
                sortOrder={m.sortOrder}
                minStock={m.minStock}
                status={m.status}
              />
            ))}
            {materials.length === 0 && <EmptyRow colSpan={6}>Belum ada item Stock Freezer.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
