import { z } from "zod";

export const chartOfAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  type: z.enum([
    "ASET",
    "KEWAJIBAN",
    "EKUITAS",
    "PENDAPATAN",
    "HARGA_POKOK_PENJUALAN",
    "BEBAN_LANGSUNG",
    "BEBAN_OPERASIONAL",
    "BEBAN_NON_OPERASIONAL",
    "PENDAPATAN_NON_OPERASIONAL",
  ]),
  normalBalance: z.enum(["DEBIT", "KREDIT"]),
  parentId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const journalVoucherSchema = z.object({
  cashBook: z.enum(["KASIR", "BRANKAS", "OUTLET", "PETTY_CASH", "BANK_BCA", "BANK_MANDIRI"]),
  entryType: z.enum(["KAS_MASUK", "KAS_KELUAR", "TRANSFER_ANTAR_BUKU"]),
  date: z.coerce.date(),
  outletId: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional(),
  contraAccountId: z.string().uuid(),
  amount: z.number().positive(),
});

export const voidJournalEntrySchema = z.object({
  reason: z.string().min(1).max(500),
});

export const adjustingEntrySchema = z
  .object({
    date: z.coerce.date(),
    description: z.string().min(1).max(500),
    reference: z.string().max(100).optional(),
    debitAccountId: z.string().uuid(),
    creditAccountId: z.string().uuid(),
    amount: z.number().positive(),
  })
  .refine((data) => data.debitAccountId !== data.creditAccountId, {
    message: "Akun debit dan kredit tidak boleh sama",
    path: ["creditAccountId"],
  });
