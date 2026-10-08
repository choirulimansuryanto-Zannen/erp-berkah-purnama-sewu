import { z } from "zod";

export const upsertCompanyMaterialClosingSchema = z.object({
  materialId: z.string().min(1),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  saldoAwalQty: z.number().default(0),
  qtyOpname: z.number().default(0),
  costPerUnit: z.number().min(0).default(0),
  fakturOutletQty: z.number().default(0),
  // Qty Total Bahan Baku is no longer an input — it's derived (Saldo Awal
  // − Saldo Akhir − Faktur Outlet), computed in src/lib/company-material.ts.
});
