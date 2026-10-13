import { z } from "zod";

// One already-classified row, ready to post — the client does the Excel
// parsing + account-mapping resolution (see JournalImportForm), this
// schema is just the server-side contract for the final "post" call.
export const journalImportRowSchema = z.object({
  date: z.string(), // ISO date, YYYY-MM-DD
  costCentre: z.string().max(200).optional(),
  subCost: z.string().max(200).optional(),
  code: z.string().max(100).optional(),
  keterangan: z.string().min(1).max(500),
  dbcr: z.enum(["DB", "CR"]),
  amount: z.number().positive(),
  contraAccountId: z.string().uuid(),
});

export const journalImportPostSchema = z.object({
  cashBook: z.enum(["KASIR", "BRANKAS", "OUTLET", "PETTY_CASH", "BANK_BCA", "BANK_MANDIRI"]),
  fileName: z.string().max(255).optional(),
  targetYear: z.number().int().min(2020).max(2100),
  targetMonth: z.number().int().min(1).max(12),
  rows: z.array(journalImportRowSchema).min(1).max(2000),
});
