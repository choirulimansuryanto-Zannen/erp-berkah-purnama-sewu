import "server-only";
import { prisma } from "@/lib/prisma";
import { computeStockPreview } from "@/lib/daily-report-stock";
import { getMaterialDraft } from "@/lib/daily-report-material-draft";

/**
 * Where each Stock Freezer item's "Pakai" (used) figure mirrors from — the
 * business's own sheet annotates a few of these explicitly ("Diambil dari
 * Form Pengeluaran Kolom Laku Beef Patty", "... Kolom Laku Kebab Super +
 * Mexican Hotdog"); the rest are inferred from the obvious name match
 * (Labanise = the kitchen's own name for the Kebab range, Cheese/Chilimeat
 * match the Daily Report stock table's topping display names). Two source
 * kinds:
 *   - "rawMaterial": mirrors that RawMaterial's qtyUsed on the Daging/Sayur/
 *     Bahan Baku (Saos & Kemasan) tables (DailyReportMaterialDraft), for the
 *     items this sheet shares 1:1 with that already-shipped feature.
 *   - "stockItems": mirrors the sum of Laku (Terjual Sistem, per round 40 —
 *     Laku defaults to Terjual Sistem until Ambil/Sisa are actually counted)
 *     across one or more DAILY_REPORT_STOCK_ITEMS entries, matched by the
 *     `itemName` computeStockPreview returns (a Product's own name, or a
 *     Topping's display alias — "Cheese" for Extra Keju, etc).
 *
 * NOT independently confirmed with the business — Labanise Super/Roti
 * Hotdog/Labanise Black Medium's mappings are the least certain of these and
 * worth double-checking against the real kitchen workflow.
 */
type PakaiSource = { type: "rawMaterial"; rawMaterialName: string } | { type: "stockItems"; itemNames: string[] };

const FREEZER_PAKAI_SOURCE: Record<string, PakaiSource> = {
  "Daging @4kg": { type: "rawMaterial", rawMaterialName: "Ketul @4kg" },
  "daging @2kg": { type: "rawMaterial", rawMaterialName: "Ketul @2kg" },
  "Beef Patty": { type: "stockItems", itemNames: ["Beef Patty"] },
  "Sosis Nidia": { type: "stockItems", itemNames: ["Sosis"] },
  "Labanise Small": { type: "stockItems", itemNames: ["Kebab Small"] },
  "Labanise Medium": { type: "stockItems", itemNames: ["Kebab Medium"] },
  "Labanise Super": { type: "stockItems", itemNames: ["Kebab Super", "Mexican Hotdog"] },
  "Labanise Jumbo": { type: "stockItems", itemNames: ["Kebab Jumbo"] },
  "Labanise Black Medium": { type: "stockItems", itemNames: ["Kebab Cheesy Black"] },
  "Roti Hotdog": { type: "stockItems", itemNames: ["American Hotdog", "Mexican Hotdog"] },
  "Burger Bun": { type: "stockItems", itemNames: ["Clasic Beef Burger"] },
  Chilimeat: { type: "stockItems", itemNames: ["Chilimeat"] },
  Cheese: { type: "stockItems", itemNames: ["Cheese"] },
  "Air Mineral Prima": { type: "stockItems", itemNames: ["Air Mineral Prima"] },
  "The Botol Sosro": { type: "stockItems", itemNames: ["Teh Botol Sosro"] },
  "Fruit Tea": { type: "stockItems", itemNames: ["Fruit Tea"] },
  Mayonaise: { type: "rawMaterial", rawMaterialName: "Mayonaise" },
  "Saos Sambal": { type: "rawMaterial", rawMaterialName: "Saos Sambal" },
  "Saos Tomat": { type: "rawMaterial", rawMaterialName: "Saos Tomat" },
  "Saos Keju": { type: "rawMaterial", rawMaterialName: "Saos Keju" },
  Mentega: { type: "rawMaterial", rawMaterialName: "Mentega" },
  "Kemasan MEDIUM": { type: "rawMaterial", rawMaterialName: "Kemasan Medium" },
  "Kemasan LARGE": { type: "rawMaterial", rawMaterialName: "Kemasan Large" },
  "Kemasan Roti Jhony": { type: "rawMaterial", rawMaterialName: "Kemasan Roti Johny" },
  "Plastik Kebab Alibaba": { type: "rawMaterial", rawMaterialName: "Plastik Kebab Alibaba" },
  "Box Burger": { type: "rawMaterial", rawMaterialName: "Box Burger" },
  "Kertas Roti": { type: "rawMaterial", rawMaterialName: "Kertas Roti" },
};

/**
 * Live "Pakai" per freezer material name, for the *current* session only —
 * mirrors either a RawMaterial's saved qtyUsed draft or the sum of Laku
 * across the mapped stock items. Returns 0 for any freezer material with no
 * mapping (defensive — every seeded item has one, but a future admin-added
 * item won't until FREEZER_PAKAI_SOURCE is updated for it).
 */
export async function computeFreezerUsedByName(
  outletId: string,
  pramuniagaId: string,
  sessionDate: Date,
  timeRange: { from: Date; to: Date },
): Promise<Record<string, number>> {
  const [stockPreview, materialDraftById, rawMaterials] = await Promise.all([
    computeStockPreview(outletId, pramuniagaId, timeRange),
    getMaterialDraft(outletId, pramuniagaId, sessionDate),
    prisma.rawMaterial.findMany({ select: { id: true, name: true } }),
  ]);

  const terjualByItemName = new Map(stockPreview.map((line) => [line.itemName, line.terjualSistem]));
  const rawMaterialIdByName = new Map(rawMaterials.map((m) => [m.name, m.id]));

  const result: Record<string, number> = {};
  for (const [freezerName, source] of Object.entries(FREEZER_PAKAI_SOURCE)) {
    if (source.type === "rawMaterial") {
      const rawMaterialId = rawMaterialIdByName.get(source.rawMaterialName);
      result[freezerName] = rawMaterialId ? (materialDraftById[rawMaterialId] ?? 0) : 0;
    } else {
      result[freezerName] = source.itemNames.reduce((sum, name) => sum + (terjualByItemName.get(name) ?? 0), 0);
    }
  }
  return result;
}
