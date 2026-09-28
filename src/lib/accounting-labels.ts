// Pure labels/constants shared between server pages and client components —
// deliberately split out of accounting.ts (which is "server-only" and pulls
// in Prisma) so a client component can import these without dragging a
// server-only module into the browser bundle.
import type { CashBook, JournalEntryType, AccountType, NormalBalance } from "@prisma/client";

export const CASH_BOOK_LABELS: Record<CashBook, string> = {
  KASIR: "Kasir",
  BRANKAS: "Brankas",
  OUTLET: "Kas Outlet",
  PETTY_CASH: "Petty Cash",
  BANK_BCA: "Bank BCA",
  BANK_MANDIRI: "Bank Mandiri",
};

export const JOURNAL_ENTRY_TYPE_LABELS: Record<JournalEntryType, string> = {
  KAS_MASUK: "Kas Masuk",
  KAS_KELUAR: "Kas Keluar",
  TRANSFER_ANTAR_BUKU: "Transfer Antar Buku",
  JURNAL_PENYESUAIAN: "Jurnal Penyesuaian",
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASET: "Aset",
  KEWAJIBAN: "Kewajiban",
  EKUITAS: "Ekuitas",
  PENDAPATAN: "Pendapatan",
  HARGA_POKOK_PENJUALAN: "Harga Pokok Penjualan",
  BEBAN_LANGSUNG: "Beban Langsung",
  BEBAN_OPERASIONAL: "Beban Operasional",
  BEBAN_NON_OPERASIONAL: "Beban Non Operasional",
  PENDAPATAN_NON_OPERASIONAL: "Pendapatan Non Operasional",
};

const INCOME_STATEMENT_TYPES: AccountType[] = [
  "PENDAPATAN",
  "HARGA_POKOK_PENJUALAN",
  "BEBAN_LANGSUNG",
  "BEBAN_OPERASIONAL",
  "BEBAN_NON_OPERASIONAL",
  "PENDAPATAN_NON_OPERASIONAL",
];

export function isIncomeStatementType(type: AccountType): boolean {
  return INCOME_STATEMENT_TYPES.includes(type);
}

/** A balance's sign follows the account's own normal side — debit-normal
 * accounts (Aset, Beban, HPP) read as (debit - credit); credit-normal
 * accounts (Kewajiban, Ekuitas, Pendapatan) read as (credit - debit). */
export function signedBalance(debit: number, credit: number, normalBalance: NormalBalance): number {
  return normalBalance === "DEBIT" ? debit - credit : credit - debit;
}

/** The natural (debit/credit) balance direction for each account TYPE as a
 * whole. Every type has a handful of "contra" accounts whose own
 * normalBalance is the OPPOSITE of their type's natural direction —
 * Akumulasi Penyusutan under ASET (credit-normal, though ASET is
 * debit-normal), Diskon Penjualan under PENDAPATAN (debit-normal, though
 * PENDAPATAN is credit-normal). Summing a type's accounts by each
 * account's OWN sign (signedBalance) silently ADDS a contra account instead
 * of subtracting it — see typeNaturalValue. */
export const TYPE_NATURAL_BALANCE: Partial<Record<AccountType, NormalBalance>> = {
  ASET: "DEBIT",
  KEWAJIBAN: "KREDIT",
  EKUITAS: "KREDIT",
  PENDAPATAN: "KREDIT",
  PENDAPATAN_NON_OPERASIONAL: "KREDIT",
  HARGA_POKOK_PENJUALAN: "DEBIT",
  BEBAN_LANGSUNG: "DEBIT",
  BEBAN_OPERASIONAL: "DEBIT",
  BEBAN_NON_OPERASIONAL: "DEBIT",
};

/** Re-signs a value that's already signed per the ACCOUNT's own
 * normalBalance (e.g. from signedBalance, or matrix.monthly/.cumulative)
 * into the sign convention of its TYPE's natural direction — a no-op for a
 * normal member of the type, a sign-flip for a contra account. Summing
 * these across a type gives the correct category subtotal (Total Aset,
 * Total Penjualan, ...); the row's own display should use this same
 * flipped value too, so a contra account reads as a deduction. */
export function typeNaturalValue(value: number, accountType: AccountType, accountNormalBalance: NormalBalance): number {
  const natural = TYPE_NATURAL_BALANCE[accountType];
  return natural && accountNormalBalance !== natural ? -value : value;
}
