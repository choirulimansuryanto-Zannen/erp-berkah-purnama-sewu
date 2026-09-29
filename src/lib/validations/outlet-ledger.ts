import { z } from "zod";

const LEDGER_SIDES = ["D", "C"] as const;

// ── OutletLedgerAccount — the Jurnal Sheet's fixed chart of accounts (admin master data) ──
export const outletLedgerAccountSchema = z.object({
  number: z.number().int().min(1).max(9999),
  label: z.string().min(1).max(200),
  defaultSide: z.enum(LEDGER_SIDES),
  sortOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const updateOutletLedgerAccountSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  defaultSide: z.enum(LEDGER_SIDES).optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// ── OutletLedgerEntry — one Jurnal Sheet ledger line (Tanggal/No.Akun/Keterangan/D-C/Nilai) ──
export const outletLedgerEntrySchema = z.object({
  outletId: z.string().uuid(),
  date: z.coerce.date(),
  accountId: z.string().uuid(),
  description: z.string().min(1).max(300),
  side: z.enum(LEDGER_SIDES),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});
