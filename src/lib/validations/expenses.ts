import { z } from "zod";

// category is a key into ExpenseCategoryDef (admin-manageable) — validated
// as a non-empty string here; the route checks it against the live DB list
// so a stale/deactivated category is rejected with a clear error instead of
// a raw FK-constraint failure.
export const submitExpenseSchema = z.object({
  category: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  date: z.coerce.date().optional(),
});

export const expenseDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export const kasbonSchema = z.object({
  amount: z.number().positive(),
  notes: z.string().optional(),
  date: z.coerce.date().optional(),
  // Which checked-in pramuniaga this kasbon belongs to — required so it's
  // attributed to whoever actually requested it, not "whoever's on duty" at
  // whatever point the list is later viewed.
  pramuniagaRosterId: z.string().uuid(),
});

export const promoDiscountSchema = z.object({
  amount: z.number().min(0),
  notes: z.string().optional(),
  date: z.coerce.date().optional(),
});

export const expenseManualEntrySchema = z.object({
  gofoodAmount: z.number().min(0).optional(),
  grabAmount: z.number().min(0).optional(),
  shopeeAmount: z.number().min(0).optional(),
  tiktokAmount: z.number().min(0).optional(),
  qponAmount: z.number().min(0).optional(),
  cashlessAmount: z.number().min(0).optional(),
  qtyKopdes: z.number().int().min(0).optional(),
  qtyMbg: z.number().int().min(0).optional(),
  date: z.coerce.date().optional(),
});

export const expenseCategorySchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Gunakan huruf besar dan underscore, contoh: BIAYA_LAIN"),
  label: z.string().min(1),
  sortOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SEASONAL"]).optional(),
  // Which section of the Akun Sheet (Laporan Outlet, d.) this category
  // feeds: DIRECT/INDIRECT = "C. BIAYA" overhead split, NONE = it's really
  // a purchase (SAYUR, GAS) and belongs in "B. PEMBELIAN" instead.
  overheadGroup: z.enum(["DIRECT", "INDIRECT", "NONE"]).optional(),
});

export const updateExpenseCategorySchema = z.object({
  label: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SEASONAL"]).optional(),
  overheadGroup: z.enum(["DIRECT", "INDIRECT", "NONE"]).optional(),
});
