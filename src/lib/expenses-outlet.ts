import "server-only";
import type { Channel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BusinessSettings } from "@/lib/business-settings";

// Order + labels match the outlet's own "Pengeluaran Online & Cashless"
// mockup exactly — every Channel except CASH (physical cash isn't a
// deduction from what's owed).
const ONLINE_CASHLESS_CHANNELS: { channel: Channel; label: string }[] = [
  { channel: "GOFOOD", label: "GO FOOD" },
  { channel: "GRAB", label: "GRAB FOOD" },
  { channel: "SHOPEE", label: "SHOPEE FOOD" },
  { channel: "TIKTOK", label: "TIKTOK" },
  { channel: "QPON", label: "QPON" },
  { channel: "CASHLESS", label: "CASHLESS" },
];

export type OnlineCashlessLine = { channel: Channel; label: string; amount: number };

/** Per-channel sales total for one pramuniaga's shift session — the "= TOTAL
 * PENJUALAN PADA 'BREAKDOWN SALES PER CHANNEL'" auto figure on the Expenses
 * page. Every channel but CASH, since cash never gets "deducted" — it's
 * physically counted instead (see Daily Report's Actual Cash Counted). */
export async function computeOnlineCashlessBreakdown(
  outletId: string,
  pramuniagaId: string,
  range: { from: Date; to: Date },
): Promise<{ lines: OnlineCashlessLine[]; total: number }> {
  const rows = await prisma.transaction.groupBy({
    by: ["channel"],
    where: {
      outletId,
      pramuniagaId,
      status: "COMPLETED",
      channel: { in: ONLINE_CASHLESS_CHANNELS.map((c) => c.channel) },
      createdAt: { gte: range.from, lte: range.to },
    },
    _sum: { total: true },
  });
  const amountByChannel = new Map(rows.map((r) => [r.channel, Number(r._sum.total ?? 0)]));

  const lines = ONLINE_CASHLESS_CHANNELS.map((c) => ({
    channel: c.channel,
    label: c.label,
    amount: amountByChannel.get(c.channel) ?? 0,
  }));
  return { lines, total: lines.reduce((sum, l) => sum + l.amount, 0) };
}

export type PotonganPenjualan = {
  qtyKopdes: number;
  qtyMbg: number;
  kopdesRate: number;
  mbgRate: number;
  kopdesAmount: number;
  mbgAmount: number;
  autoTotal: number;
};

/** Paket Hemat auto-discount — qty of Paket Kopdes/MBG sold this session ×
 * the per-unit rate from Business Settings (admin-editable, see
 * paketHematKopdesDiscount/paketHematMbgDiscount). The "Promo" manual line
 * lives separately in PromoDiscount — this only covers the system-computed
 * half of Potongan Penjualan. */
export async function computePotonganPenjualan(
  outletId: string,
  pramuniagaId: string,
  range: { from: Date; to: Date },
  settings: Pick<BusinessSettings, "paketHematKopdesDiscount" | "paketHematMbgDiscount">,
): Promise<PotonganPenjualan> {
  const items = await prisma.transactionItem.findMany({
    where: {
      transaction: { outletId, pramuniagaId, status: "COMPLETED", createdAt: { gte: range.from, lte: range.to } },
      product: { category: { in: ["PAKET_KOPDES", "PAKET_MBG"] } },
    },
    select: { qty: true, product: { select: { category: true } } },
  });

  const qtyKopdes = items.filter((i) => i.product.category === "PAKET_KOPDES").reduce((sum, i) => sum + i.qty, 0);
  const qtyMbg = items.filter((i) => i.product.category === "PAKET_MBG").reduce((sum, i) => sum + i.qty, 0);
  const kopdesAmount = qtyKopdes * settings.paketHematKopdesDiscount;
  const mbgAmount = qtyMbg * settings.paketHematMbgDiscount;

  return {
    qtyKopdes,
    qtyMbg,
    kopdesRate: settings.paketHematKopdesDiscount,
    mbgRate: settings.paketHematMbgDiscount,
    kopdesAmount,
    mbgAmount,
    autoTotal: kopdesAmount + mbgAmount,
  };
}
