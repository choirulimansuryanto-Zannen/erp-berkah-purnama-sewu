import { prisma } from "@/lib/prisma";

// Buku Pencatatan Piutang — "Historical Account Receivable". `group` mirrors
// the business's own bottom-summary buckets; Saldo Bulan Lalu/Penambahan/
// Pembayaran/Saldo Bulan Ini are all DERIVED here per selected month, never
// stored — verified to reconcile exactly against the source's own printed
// totals for every group, for Sep-2026.
export const RECEIVABLE_GROUP_LABELS: Record<string, string> = {
  OUTLET: "Outlet",
  MITRA: "Mitra",
  SAYUR: "Sayur",
  KOBAR: "Kobar",
  MANGKACAU: "Mangkacau",
  TORTILLA: "Tortilla",
  MIE_STEAK: "Mie Steak",
};
export const RECEIVABLE_GROUP_ORDER = ["OUTLET", "MITRA", "SAYUR", "KOBAR", "MANGKACAU", "TORTILLA", "MIE_STEAK"] as const;

export async function getReceivableLedger(year: number, month: number) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const entries = await prisma.receivableEntry.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }] });

  const detailRows = entries
    .filter((e) => e.date >= monthStart && e.date <= monthEnd)
    .map((e) => ({
      id: e.id,
      no: null as number | null,
      date: e.date,
      mitraCode: e.mitraCode,
      mitraName: e.mitraName,
      noFaktur: e.noFaktur,
      tglFaktur: e.tglFaktur,
      description: e.description,
      debt: Number(e.debt),
      credit: Number(e.credit),
      remarks: e.remarks,
      group: e.group,
    }));

  const groupSummary = RECEIVABLE_GROUP_ORDER.map((g) => {
    const before = entries.filter((e) => e.group === g && e.date < monthStart);
    const within = entries.filter((e) => e.group === g && e.date >= monthStart && e.date <= monthEnd);
    const saldoBulanLalu = before.reduce((s, e) => s + Number(e.debt) - Number(e.credit), 0);
    const penambahan = within.reduce((s, e) => s + Number(e.debt), 0);
    const pembayaran = within.reduce((s, e) => s + Number(e.credit), 0);
    return { group: g, label: RECEIVABLE_GROUP_LABELS[g], saldoBulanLalu, penambahan, pembayaran, saldoBulanIni: saldoBulanLalu + penambahan - pembayaran };
  });

  const total = groupSummary.reduce(
    (acc, g) => ({
      saldoBulanLalu: acc.saldoBulanLalu + g.saldoBulanLalu,
      penambahan: acc.penambahan + g.penambahan,
      pembayaran: acc.pembayaran + g.pembayaran,
      saldoBulanIni: acc.saldoBulanIni + g.saldoBulanIni,
    }),
    { saldoBulanLalu: 0, penambahan: 0, pembayaran: 0, saldoBulanIni: 0 },
  );

  return { detailRows, groupSummary, total };
}
