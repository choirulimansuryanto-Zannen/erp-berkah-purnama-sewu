import { z } from "zod";

// One already-parsed row, ready to post — the client does the Excel
// parsing (see JournalImportForm), this schema is the server-side
// contract for the final "post" call. The akun lawan is no longer part
// of this payload at all — postJournalImportBatch resolves it itself
// from each Buku Kas's own Transitory account.
export const journalImportRowSchema = z.object({
  date: z.string(), // ISO date, YYYY-MM-DD
  costCentre: z.string().max(200).optional(),
  subCost: z.string().max(200).optional(),
  code: z.string().max(100).optional(),
  keterangan: z.string().min(1).max(500),
  dbcr: z.enum(["DB", "CR"]),
  amount: z.number().positive(),
});

export const journalImportPostSchema = z.object({
  cashBook: z.enum(["KASIR", "BRANKAS", "OUTLET", "PETTY_CASH", "BANK_BCA", "BANK_MANDIRI"]),
  fileName: z.string().max(255).optional(),
  targetYear: z.number().int().min(2020).max(2100),
  targetMonth: z.number().int().min(1).max(12),
  rows: z.array(journalImportRowSchema).min(1).max(5000),
});
