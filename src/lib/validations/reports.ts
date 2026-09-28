import { z } from "zod";

export const dailyReportSubmitSchema = z.object({
  actualCashCounted: z.number().min(0),
  notes: z.string().optional(),
  date: z.coerce.date().optional(),
});

export const stockDraftSchema = z.object({
  itemIndex: z.number().int().min(0),
  ambil: z.number().int().min(0),
  sisa: z.number().int().min(0),
  date: z.coerce.date().optional(),
});

export const materialDraftSchema = z.object({
  rawMaterialId: z.string().uuid(),
  qtyUsed: z.number().min(0),
  date: z.coerce.date().optional(),
});

export const reportValidationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REVISION"]),
  notes: z.string().optional(),
});
