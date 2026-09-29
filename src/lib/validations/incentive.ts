import { z } from "zod";

const INCENTIVE_TYPES = [
  "PRAMU", "SPV", "PENGELOLA", "OFFICER_SALES", "HEAD_SALES",
  "OFFICER_MARKETING", "HEAD_MARKETING", "HEAD_FA", "HEAD_OPERASIONAL", "MANAGEMENT",
] as const;
const INCENTIVE_BASES = ["PERSEN_OMSET", "PERSEN_LABA_KOTOR", "PERSEN_LABA_BERSIH", "NOMINAL_TETAP"] as const;

export const incentiveRuleUpdateSchema = z.object({
  type: z.enum(INCENTIVE_TYPES),
  basis: z.enum(INCENTIVE_BASES),
  rate: z.number().min(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const investorSchema = z.object({
  name: z.string().min(1).max(200),
  ownershipPct: z.number().min(0).max(100),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  note: z.string().max(500).optional(),
});

export const sharingProfitRuleSchema = z.object({
  rate: z.number().min(0).max(100),
});

export const outletPurchaseSchema = z.object({
  outletId: z.string().uuid(),
  date: z.coerce.date(),
  description: z.string().min(1).max(300),
  qty: z.number().positive(),
  unit: z.string().min(1).max(20).optional(),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});

export const runCalculationSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});
