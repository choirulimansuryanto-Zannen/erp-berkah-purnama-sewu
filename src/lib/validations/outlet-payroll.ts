import { z } from "zod";

// Absen Sheet's Labor Cost / Salary — manually entered per pramuniaga per
// month (see OutletPayroll model). Upsert-style: re-submitting the same
// outlet+user+month replaces the figures.
export const outletPayrollSchema = z.object({
  outletId: z.string().uuid(),
  userId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  laborCost: z.number().min(0),
  salary: z.number().min(0),
  note: z.string().max(500).optional(),
});
