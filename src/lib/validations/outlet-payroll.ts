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
  // Both optional — the existing Absen Sheet form (OutletPayrollInput)
  // never sends these, only the new Summary Gaji & Tunjangan panel does.
  // Omitting totalAbsenOverride leaves it at "use days-in-month" (null).
  totalAbsenOverride: z.number().int().min(0).max(31).optional(),
  refMultiplier: z.number().min(0).max(100).optional(),
  note: z.string().max(500).optional(),
});

// The 3 flat BIAYA figures on the Summary Gaji & Tunjangan panel — one row
// per (outlet, year, month), upsert same as outletPayrollSchema.
// insentiveOperatorAmount is optional/unused by the current UI (that
// figure is now computed, not manual — see getGajiTunjanganSummary) but
// stays accepted so an existing stored value is never silently reset.
export const outletMonthlyBenefitSchema = z.object({
  outletId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  tunjanganOutlet: z.number().min(0),
  gajiPengelola: z.number().min(0),
  fullshiftAmount: z.number().min(0),
  insentiveOperatorAmount: z.number().min(0).optional(),
});
