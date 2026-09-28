import { z } from "zod";

export const dailyStockCheckSchema = z.object({
  productId: z.string().uuid(),
  openingBalance: z.number().int().min(0),
  received: z.number().int().min(0).default(0),
  used: z.number().int().min(0).default(0),
  rejected: z.number().int().min(0).default(0),
  closingBalance: z.number().int().min(0),
  varianceReason: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

export const stockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  qtyChange: z.number().int().refine((v) => v !== 0, "qtyChange must not be zero"),
  reason: z.string().min(1),
  photoUrl: z.string().url(),
});

export const stockAdjustmentDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

// "used" is deliberately absent — always server-recomputed from the live
// Pakai mirror (see computeFreezerUsedByName), never trusted from the client.
export const freezerStockRecordSchema = z.object({
  freezerMaterialId: z.string().uuid(),
  openingBalance: z.number().int().min(0),
  received: z.number().int().min(0),
  rejected: z.number().int().min(0),
});
