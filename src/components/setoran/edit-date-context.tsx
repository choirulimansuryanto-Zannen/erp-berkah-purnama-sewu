"use client";

import { createContext, useContext } from "react";

/**
 * The date (YYYY-MM-DD) of the PENDING/REJECTED report currently being
 * revised via `/setoran?editDate=...`, or null for the live session. Read by
 * every mutating fetch in this page's subtree (stock/material drafts, manual
 * entry, promo, kasbon, expenses, daily-submit) so they all target the same
 * date the server resolved it to — avoids threading one more prop through
 * every intermediate component between SetoranOutletView and each leaf form.
 */
const EditDateContext = createContext<string | null>(null);

export function EditDateProvider({ value, children }: { value: string | null; children: React.ReactNode }) {
  return <EditDateContext.Provider value={value}>{children}</EditDateContext.Provider>;
}

export function useEditDate(): string | null {
  return useContext(EditDateContext);
}
