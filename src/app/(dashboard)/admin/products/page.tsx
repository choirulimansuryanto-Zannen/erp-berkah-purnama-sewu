import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { CreateProductForm } from "@/components/admin/create-product-form";
import { ProductRow } from "@/components/admin/product-row";

export default async function AdminProductsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const [products, soldProductIds] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    prisma.transactionItem.findMany({ distinct: ["productId"], select: { productId: true } }),
  ]);
  const soldProductIdSet = new Set(soldProductIds.map((i) => i.productId));

  return (
    <div className="space-y-6">
      <PageHeader title="Products & Menu" description="Kelola SKU, harga jual, HPP, dan status produk." />

      <CreateProductForm />

      <Card>
        <CardHeader>
          <CardTitle>Semua Produk ({products.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th>SKU</Th>
              <Th>Kategori</Th>
              <Th>Harga Jual</Th>
              <Th>HPP</Th>
              <Th>Margin</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {products.map((p) => (
              <ProductRow
                key={p.id}
                id={p.id}
                sku={p.sku}
                name={p.name}
                category={p.category}
                price={Number(p.price)}
                cost={Number(p.cost)}
                status={p.status}
                hasSales={soldProductIdSet.has(p.id)}
              />
            ))}
            {products.length === 0 && <EmptyRow colSpan={8}>Belum ada produk.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
