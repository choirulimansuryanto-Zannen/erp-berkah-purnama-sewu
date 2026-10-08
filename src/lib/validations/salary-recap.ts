import { z } from "zod";

export const upsertSalaryRecapSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  department: z.enum(["BOD", "PRODUCTION", "OPERATION", "SALES_OFFICE", "SALES_OUTLET", "MARKETING", "FA", "HR_GA"]),
  totalTerimaNet: z.number().min(0).default(0),
  koperasi: z.number().min(0).default(0),
  iuranBpjs: z.number().min(0).default(0),
  kasbon: z.number().min(0).default(0),
  pph21: z.number().min(0).default(0),
  adjLain: z.number().min(0).default(0),
  sanksi: z.number().min(0).default(0),
  insentifTjOutlet: z.number().min(0).default(0),
});
