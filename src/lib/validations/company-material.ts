import { z } from "zod";

export const upsertCompanyMaterialClosingSchema = z.object({
  materialId: z.string().min(1),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  qtyOpname: z.number().min(0).default(0),
  costPerUnit: z.number().min(0).default(0),
  fakturOutletQty: z.number().min(0).default(0),
  fakturOutletNominal: z.number().min(0).default(0),
  adjustmentFakturQty: z.number().default(0),
  adjustmentFakturNominal: z.number().default(0),
});
