export type TransactionTopping = { toppingId: string; toppingName: string; qty: number; unitPrice: number };
export type TransactionItemRow = {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  toppings: TransactionTopping[];
};
export type TransactionRow = {
  id: string;
  time: string;
  channel: string;
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
  itemsSummary: string;
  kasirName: string;
  outletName: string;
  memberId: string | null;
  memberName: string | null;
  // Which of the 3 mutually-exclusive Per Member buckets this transaction
  // falls into — see resolveKasirName's neighbor in transaction-history.ts
  // for the classification rule (member.createdAt vs. this transaction's).
  segment: "LOYALTY" | "NON_MEMBER" | "NEW_REGISTER";
  items: TransactionItemRow[];
};

/** Short, stable, human-readable reference for a transaction — derived from
 * its id (no separate sequence exists), not a real receipt/invoice number. */
export function trxCode(id: string): string {
  return `TRX-${id.slice(0, 8).toUpperCase()}`;
}
