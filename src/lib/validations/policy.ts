import { z } from "zod";

export const attendancePolicySchema = z.object({
  checkpointStartHour: z.number().int().min(0).max(23),
  checkpointEndHour: z.number().int().min(0).max(23),
  checkpointIntervalMinutes: z.number().int().min(5).max(240),
  gracePeriodMinutes: z.number().int().min(0).max(120),
  annualLeaveDays: z.number().int().min(0).max(60),
  sickLeaveDays: z.number().int().min(0).max(60),
  personalLeaveDays: z.number().int().min(0).max(30),
});
