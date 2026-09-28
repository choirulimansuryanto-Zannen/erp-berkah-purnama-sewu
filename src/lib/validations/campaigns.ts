import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  targetTier: z.enum(["BRONZE", "SILVER", "GOLD"]).optional(),
  bonusMultiplier: z.number().min(1).max(10).default(1),
  discountPercent: z.number().min(0).max(100).optional(),
  budgetCap: z.number().min(0).optional(),
});

export const updateCampaignStatusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ENDED"]),
});
