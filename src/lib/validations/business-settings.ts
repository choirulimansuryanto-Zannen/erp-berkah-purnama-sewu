import { z } from "zod";

export const businessSettingsSchema = z.object({
  expenseAutoApproveLimit: z.number().min(0),
  posDiscountSpvThresholdPercent: z.number().min(0).max(100),
  voidWindowMinutes: z.number().int().min(1),
  cashVarianceAutoApprove: z.number().min(0),
  cashVarianceSpvReview: z.number().min(0),

  memberAnnualSpendWindowDays: z.number().int().min(1),
  loyaltySilverThreshold: z.number().min(0),
  loyaltyGoldThreshold: z.number().min(0),
  loyaltyBronzeMultiplier: z.number().min(0),
  loyaltySilverMultiplier: z.number().min(0),
  loyaltyGoldMultiplier: z.number().min(0),
  loyaltyPointsPerRupiah: z.number().min(0),
  loyaltyRupiahPerPointRedeemed: z.number().min(0),

  stockUnitTolerance: z.number().int().min(0),
  stockPercentTolerance: z.number().min(0).max(100),
  inventoryEscalationUnits: z.number().int().min(0),
  expiryWarningDays: z.number().int().min(0),

  businessHourStart: z.number().int().min(0).max(23),
  businessHourEnd: z.number().int().min(0).max(23),
  pacingRedThresholdPercent: z.number().min(0).max(100),
  pacingYellowThresholdPercent: z.number().min(0).max(100),

  paketHematKopdesDiscount: z.number().min(0),
  paketHematMbgDiscount: z.number().min(0),
});
