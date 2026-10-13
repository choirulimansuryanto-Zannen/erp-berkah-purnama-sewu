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

// `rows` is capped per REQUEST, not per file — JournalImportForm splits a
// large file into chunks well under this (see CHUNK_SIZE there) to stay
// under Vercel's ~4.5MB request body limit, something a file-wide row cap
// can't protect against on its own (confirmed 2026-10-13 against a real
// Outlet statement bigger than the old 5000-row-per-file limit). This cap
// just guards a single request from being absurdly large.
export const journalImportPostSchema = z.object({
  cashBook: z.enum(["KASIR", "BRANKAS", "OUTLET", "PETTY_CASH", "BANK_BCA", "BANK_MANDIRI"]),
  fileName: z.string().max(255).optional(),
  targetYear: z.number().int().min(2020).max(2100),
  targetMonth: z.number().int().min(1).max(12),
  rows: z.array(journalImportRowSchema).min(1).max(2000),
  // Set on every chunk after the first — see postJournalImportBatch.
  existingBatchId: z.string().uuid().optional(),
});
