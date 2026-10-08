import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { CreateVendorForm } from "@/components/admin/create-vendor-form";
import { VendorRow } from "@/components/admin/vendor-row";

export default async function AdminVendorsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const vendors = await prisma.vendor.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Vendor" description="Kelola daftar vendor untuk Buku Hutang Vendor." />

      <CreateVendorForm />

      <Card>
        <CardHeader>
          <CardTitle>Semua Vendor ({vendors.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {vendors.map((v) => (
              <VendorRow key={v.id} id={v.id} name={v.name} status={v.status} />
            ))}
            {vendors.length === 0 && <EmptyRow colSpan={3}>Belum ada vendor.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
