import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReceivingForm } from "@/components/warehouse/receiving-form";
import { DistributionForm } from "@/components/warehouse/distribution-form";
import { DistributionStatusControl } from "@/components/warehouse/distribution-status-control";
import { StockMinLevelRow } from "@/components/warehouse/stock-min-level-row";
import { getBusinessSettings } from "@/lib/business-settings";

const DISTRIBUTION_STATUS_TONE = { PENDING: "neutral", IN_TRANSIT: "warning", DELIVERED: "success" } as const;

export default async function WarehousePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "warehouse:manage")) redirect("/dashboard");

  const settings = await getBusinessSettings();
  const expiryCutoff = new Date();
  expiryCutoff.setDate(expiryCutoff.getDate() + settings.expiryWarningDays);

  const [products, outlets, distributions, expiringLots] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE" }, include: { warehouseStock: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    prisma.outlet.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.stockDistribution.findMany({
      where: { status: { not: "DELIVERED" } },
      include: { product: true, outlet: true, requestedBy: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.warehouseReceiving.findMany({
      where: { expiryDate: { lte: expiryCutoff } },
      include: { product: true },
      orderBy: { expiryDate: "asc" },
      take: 20,
    }),
  ]);

  const reorderCount = products.filter(
    (p) => (p.warehouseStock?.minLevel ?? 0) > 0 && (p.warehouseStock?.qtyOnHand ?? 0) < (p.warehouseStock?.minLevel ?? 0),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse"
        description="Stok gudang pusat, penerimaan barang, distribusi ke outlet, dan reorder alert."
      />

      {(reorderCount > 0 || expiringLots.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {reorderCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
              <AlertTriangle className="h-4 w-4" />
              {reorderCount} produk di bawah minimum stok
            </div>
          )}
          {expiringLots.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              {expiringLots.length} lot mendekati/lewat kedaluwarsa (≤{settings.expiryWarningDays} hari)
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReceivingForm products={products.map((p) => ({ id: p.id, name: p.name }))} />
        <DistributionForm
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stok Gudang</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Produk</Th>
              <Th>SKU</Th>
              <Th>Qty on Hand</Th>
              <Th>Min Level</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {products.map((p) => (
              <StockMinLevelRow
                key={p.id}
                productId={p.id}
                productName={p.name}
                sku={p.sku}
                qtyOnHand={p.warehouseStock?.qtyOnHand ?? 0}
                minLevel={p.warehouseStock?.minLevel ?? 0}
              />
            ))}
            {products.length === 0 && <EmptyRow colSpan={6}>Belum ada produk.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribusi Berjalan</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Produk</Th>
              <Th>Outlet Tujuan</Th>
              <Th>Qty</Th>
              <Th>Diminta Oleh</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {distributions.map((d) => (
              <Tr key={d.id}>
                <Td className="font-medium text-slate-900">{d.product.name}</Td>
                <Td>{d.outlet.name}</Td>
                <Td>{d.qty}</Td>
                <Td>{d.requestedBy?.name ?? "-"}</Td>
                <Td>
                  <Badge tone={DISTRIBUTION_STATUS_TONE[d.status]}>{d.status}</Badge>
                </Td>
                <Td>
                  <DistributionStatusControl id={d.id} status={d.status} />
                </Td>
              </Tr>
            ))}
            {distributions.length === 0 && <EmptyRow colSpan={6}>Tidak ada distribusi berjalan.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lot Mendekati Kedaluwarsa</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Produk</Th>
              <Th>Lot</Th>
              <Th>Qty Diterima</Th>
              <Th>Expiry Date</Th>
            </tr>
          </Thead>
          <tbody>
            {expiringLots.map((l) => (
              <Tr key={l.id}>
                <Td className="font-medium text-slate-900">{l.product.name}</Td>
                <Td>{l.lotNumber}</Td>
                <Td>{l.qty}</Td>
                <Td>
                  <Badge tone={l.expiryDate && l.expiryDate < new Date() ? "danger" : "warning"}>
                    {l.expiryDate?.toLocaleDateString("id-ID") ?? "-"}
                  </Badge>
                </Td>
              </Tr>
            ))}
            {expiringLots.length === 0 && <EmptyRow colSpan={4}>Tidak ada lot yang mendekati kedaluwarsa.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
