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
