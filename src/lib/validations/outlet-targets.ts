import { z } from "zod";

export const upsertOutletMonthlyTargetSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  monthlyTarget: z.number().min(0),
  dailyTarget: z.number().min(0),
  insentifMonthlyTarget: z.number().min(0),
  insentifDailyTarget: z.number().min(0),
  fullshiftDailyTarget: z.number().min(0),
});
