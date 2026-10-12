import { z } from "zod";

// Creates (or adds another outlet share to) a named investor — see
// lib/outlet-investor.ts. investorId is omitted to create a brand-new
// investor (investorName required then); provided to add another outlet
// share under an EXISTING investor (investorName ignored).
export const createOutletInvestorShareSchema = z.object({
  investorId: z.string().uuid().optional(),
  investorName: z.string().min(1).max(200).optional(),
  outletId: z.string().uuid(),
  slotNumber: z.number().int().min(1).max(5),
  shareType: z.enum(["PERSEN", "NOMINAL"]),
  shareValue: z.number().min(0),
  openingBalance: z.number().optional(), // only used when creating a new investor
});

export const updateInvestorLedgerCellSchema = z.object({
  investorId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  adj: z.number().optional(),
  // Passing null explicitly clears an override (goes back to computed);
  // omitting the key leaves it untouched; a number sets/locks it.
  accumOverride: z.number().nullable().optional(),
  transferSharedOverride: z.number().nullable().optional(),
});
