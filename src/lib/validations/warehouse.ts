import { z } from "zod";

export const receivingSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive(),
  lotNumber: z.string().min(1),
  expiryDate: z.coerce.date().optional(),
  supplierName: z.string().optional(),
});

export const distributionSchema = z.object({
  productId: z.string().uuid(),
  outletId: z.string().uuid(),
  qty: z.number().int().positive(),
  lotNumber: z.string().optional(),
});

export const distributionStatusSchema = z.object({
  status: z.enum(["IN_TRANSIT", "DELIVERED"]),
});

export const minLevelSchema = z.object({
  minLevel: z.number().int().min(0),
});
