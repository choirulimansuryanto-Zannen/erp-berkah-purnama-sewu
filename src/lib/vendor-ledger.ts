import { prisma } from "@/lib/prisma";

// Buku Hutang Vendor — one running ledger per vendor. Debet/Kredit and the
// running Saldo are all DERIVED from each entry's (hutang, bayar), never
// stored: Kredit = Hutang (a new payable increases what's owed), Debet =
// Bayar (a payment reduces it), Saldo = running sum of (hutang − bayar).
export async function getVendorLedgers() {
  const vendors = await prisma.vendor.findMany({
    where: { status: "ACTIVE" },
    include: { ledgerEntries: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] } },
    orderBy: { sortOrder: "asc" },
  });

  return vendors.map((v) => {
    let saldo = 0;
    const rows = v.ledgerEntries.map((e) => {
      const hutang = Number(e.hutang);
      const bayar = Number(e.bayar);
      saldo += hutang - bayar;
      return { id: e.id, date: e.date, hutang, bayar, debet: bayar, kredit: hutang, remarks: e.remarks, runningSaldo: saldo };
    });
    return {
      id: v.id,
      name: v.name,
      rows,
      totalHutang: rows.reduce((s, r) => s + r.hutang, 0),
      totalBayar: rows.reduce((s, r) => s + r.bayar, 0),
      saldoAkhir: saldo,
    };
  });
}
