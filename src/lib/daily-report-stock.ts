import "server-only";
import { prisma } from "@/lib/prisma";
import { DAILY_REPORT_STOCK_ITEMS } from "@/lib/daily-report-stock-items";

export type StockPreviewLine = {
  productId: string | null;
  toppingId: string | null;
  itemName: string;
  unitPrice: number;
  terjualSistem: number;
};

/**
 * `terjualSistem` per tracked item for one pramuniaga's shift session —
 * the system-of-record sold count the cashier's manual Ambil/Sisa count
 * gets cross-checked against. Computed fresh both for the pre-submit
 * preview (this function) and again server-side at submit time (same
 * query, see daily-submit's route) — the client's copy is never trusted.
 */
export async function computeStockPreview(
  outletId: string,
  pramuniagaId: string,
  range: { from: Date; to: Date },
): Promise<StockPreviewLine[]> {
  const productNames = DAILY_REPORT_STOCK_ITEMS.filter((i) => i.kind === "PRODUCT").map((i) => i.productName);
  const toppingNames = DAILY_REPORT_STOCK_ITEMS.filter((i) => i.kind === "TOPPING").map((i) => i.toppingName);

  const [products, toppings, items, packageComponents] = await Promise.all([
    prisma.product.findMany({ where: { name: { in: productNames } } }),
    prisma.topping.findMany({ where: { name: { in: toppingNames } } }),
    prisma.transactionItem.findMany({
      where: {
        transaction: { outletId, pramuniagaId, status: "COMPLETED", createdAt: { gte: range.from, lte: range.to } },
      },
      select: { productId: true, qty: true, toppings: { select: { toppingId: true, qty: true } } },
    }),
    // Selling a paket consumes its components from the kitchen's stock the
    // same as selling them individually would — decomposed below so a
    // package sale is reflected in its components' terjualSistem too, not
    // just in the package's own (untracked) product line.
    prisma.packageComponent.findMany({
      select: { packageProductId: true, componentProductId: true, componentToppingId: true, qty: true },
    }),
  ]);

  const productByName = new Map(products.map((p) => [p.name, p]));
  const toppingByName = new Map(toppings.map((t) => [t.name, t]));
  const componentsByPackageId = new Map<string, typeof packageComponents>();
  for (const c of packageComponents) {
    const list = componentsByPackageId.get(c.packageProductId) ?? [];
    list.push(c);
    componentsByPackageId.set(c.packageProductId, list);
  }

  const soldByProduct = new Map<string, number>();
  const soldByTopping = new Map<string, number>();
  for (const item of items) {
    soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? 0) + item.qty);
    for (const t of item.toppings) {
      soldByTopping.set(t.toppingId, (soldByTopping.get(t.toppingId) ?? 0) + t.qty);
    }

    const components = componentsByPackageId.get(item.productId);
    if (components) {
      for (const c of components) {
        const consumed = item.qty * c.qty;
        if (c.componentProductId) {
          soldByProduct.set(c.componentProductId, (soldByProduct.get(c.componentProductId) ?? 0) + consumed);
        } else if (c.componentToppingId) {
          soldByTopping.set(c.componentToppingId, (soldByTopping.get(c.componentToppingId) ?? 0) + consumed);
        }
      }
    }
  }

  return DAILY_REPORT_STOCK_ITEMS.map((spec) => {
    if (spec.kind === "PRODUCT") {
      const p = productByName.get(spec.productName);
      return {
        productId: p?.id ?? null,
        toppingId: null,
        itemName: spec.productName,
        unitPrice: p ? Number(p.price) : 0,
        terjualSistem: p ? (soldByProduct.get(p.id) ?? 0) : 0,
      };
    }
    const t = toppingByName.get(spec.toppingName);
    return {
      productId: null,
      toppingId: t?.id ?? null,
      itemName: spec.displayName,
      unitPrice: t ? Number(t.price) : 0,
      terjualSistem: t ? (soldByTopping.get(t.id) ?? 0) : 0,
    };
  });
}
