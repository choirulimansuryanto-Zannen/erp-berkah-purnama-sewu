import { z } from "zod";

export const createVoucherSchema = z.object({
  code: z.string().min(3).max(30),
  description: z.string().optional(),
  rewardProductId: z.string().uuid(),
  rewardQty: z.number().int().min(1).default(1),
  maxRedemptions: z.number().int().min(1).optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
});

export const updateVoucherSchema = z.object({
  description: z.string().optional(),
  rewardProductId: z.string().uuid().optional(),
  rewardQty: z.number().int().min(1).optional(),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  validFrom: z.coerce.date().nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const redeemVoucherSchema = z.object({
  code: z.string().min(1),
  memberId: z.string().uuid().optional(),
});
