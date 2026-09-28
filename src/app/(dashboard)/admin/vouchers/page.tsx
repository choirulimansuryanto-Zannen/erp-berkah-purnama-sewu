import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { CreateVoucherForm } from "@/components/admin/create-voucher-form";
import { VoucherRow } from "@/components/admin/voucher-row";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";

export default async function VouchersPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const [vouchers, products] = await Promise.all([
    prisma.voucher.findMany({ include: { rewardProduct: true }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vouchers"
        description="Kode voucher yang bisa diklaim member untuk mendapatkan produk gratis."
      />

      <CreateVoucherForm products={products.map((p) => ({ id: p.id, name: p.name }))} />

      <Card>
        <CardHeader>
          <CardTitle>Daftar Voucher</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Kode</Th>
              <Th>Hadiah</Th>
              <Th>Klaim</Th>
              <Th>Masa Berlaku</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <tbody>
            {vouchers.map((v) => (
              <VoucherRow
                key={v.id}
                id={v.id}
                code={v.code}
                rewardProductName={v.rewardProduct.name}
                rewardQty={v.rewardQty}
                redemptionCount={v.redemptionCount}
                maxRedemptions={v.maxRedemptions}
                validFrom={v.validFrom?.toISOString() ?? null}
                validUntil={v.validUntil?.toISOString() ?? null}
                status={v.status}
              />
            ))}
            {vouchers.length === 0 && <EmptyRow colSpan={6}>Belum ada voucher.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
