import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { signedBalance } from "@/lib/accounting";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Buku Besar — EVERY active account's own ledger for the period, all on one
// page (not a one-account-at-a-time picker): an account with real mutasi
// gets its full Saldo Awal + baris mutasi + Saldo Akhir table; an account
// with none still shows up (per the business's own request — "yg ada
// tampilkan, yg tdk ada juga tampilkan") but as a single compact line, so
// scrolling past the many header/rollup and not-yet-used accounts stays
// light. Two bulk queries (not one per account) keep 260+ accounts cheap.
export default async function FinanceLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const { from, to } = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeFrom = from ? new Date(`${from}T00:00:00`) : defaultFrom;
  const rangeTo = to ? new Date(`${to}T23:59:59.999`) : now;

  const [accounts, openingLines, periodLines] = await Promise.all([
    prisma.chartOfAccount.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } }),
    prisma.journalEntryLine.findMany({
      where: { account: { status: "ACTIVE" }, journalEntry: { status: "POSTED", date: { lt: rangeFrom } } },
      select: { accountId: true, debit: true, credit: true },
    }),
    prisma.journalEntryLine.findMany({
      where: { account: { status: "ACTIVE" }, journalEntry: { status: "POSTED", date: { gte: rangeFrom, lte: rangeTo } } },
      include: { journalEntry: true },
      orderBy: [{ journalEntry: { date: "asc" } }],
    }),
  ]);

  const openingByAccount = new Map<string, { debit: number; credit: number }>();
  for (const l of openingLines) {
    const acc = openingByAccount.get(l.accountId) ?? { debit: 0, credit: 0 };
    acc.debit += Number(l.debit);
    acc.credit += Number(l.credit);
    openingByAccount.set(l.accountId, acc);
  }
  const periodByAccount = new Map<string, typeof periodLines>();
  for (const l of periodLines) {
    const list = periodByAccount.get(l.accountId) ?? [];
    list.push(l);
    periodByAccount.set(l.accountId, list);
  }

  const ledgers = accounts.map((a) => {
    const opening = openingByAccount.get(a.id);
    const openingBalance = opening ? signedBalance(opening.debit, opening.credit, a.normalBalance) : 0;
    let running = openingBalance;
    const rows = (periodByAccount.get(a.id) ?? []).map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      running += signedBalance(debit, credit, a.normalBalance);
      return {
        id: l.id,
        date: l.journalEntry.date,
        entryNumber: l.journalEntry.entryNumber,
        description: l.journalEntry.description,
        debit,
        credit,
        running,
      };
    });
    return { account: a, openingBalance, rows, endingBalance: running };
  });

  const activeCount = ledgers.filter((l) => l.rows.length > 0 || l.openingBalance !== 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buku Besar"
        description={`Mutasi per akun — seluruh ${accounts.length} akun aktif ditampilkan (${activeCount} ada mutasi/saldo, ${accounts.length - activeCount} belum ada transaksi).`}
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />

      <div className="space-y-3">
        {ledgers.map(({ account, openingBalance, rows, endingBalance }) => {
          const isEmpty = rows.length === 0 && openingBalance === 0;

          if (isEmpty) {
            return (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-white px-4 py-2 text-xs"
              >
                <span>
                  <span className="mr-2 font-mono text-slate-400">{account.code}</span>
                  <span className="text-slate-500">{account.name}</span>
                </span>
                <span className="text-slate-300">Belum ada transaksi pada periode ini</span>
              </div>
            );
          }

          return (
            <Card key={account.id} className="p-0">
              <CardHeader className="sticky top-16 z-30 h-14 bg-white">
                <CardTitle className="truncate">
                  {account.code} — {account.name}
                </CardTitle>
                <span className={`text-sm font-bold tabular-nums ${endingBalance < 0 ? "text-rose-600" : "text-brand-900"}`}>
                  {currency.format(endingBalance)}
                </span>
              </CardHeader>
              <Table wrapperClassName="max-h-[40vh] overflow-y-auto">
                <Thead className="sticky top-0 z-20 bg-slate-50">
                  <tr>
                    <Th>Tanggal</Th>
                    <Th>No. Voucher</Th>
                    <Th>Keterangan</Th>
                    <Th className="text-right">Debit</Th>
                    <Th className="text-right">Kredit</Th>
                    <Th className="text-right">Saldo</Th>
                  </tr>
                </Thead>
                <tbody>
                  <Tr className="bg-slate-50">
                    <Td colSpan={5} className="font-semibold text-slate-600">
                      Saldo Awal ({rangeFrom.toLocaleDateString("id-ID")})
                    </Td>
                    <Td className="text-right font-semibold text-slate-800">{currency.format(openingBalance)}</Td>
                  </Tr>
                  {rows.map((r) => (
                    <Tr key={r.id}>
                      <Td>{r.date.toLocaleDateString("id-ID")}</Td>
                      <Td className="font-mono text-xs text-slate-500">{r.entryNumber}</Td>
                      <Td>{r.description}</Td>
                      <Td className="text-right">{r.debit > 0 ? currency.format(r.debit) : "-"}</Td>
                      <Td className="text-right">{r.credit > 0 ? currency.format(r.credit) : "-"}</Td>
                      <Td className="text-right font-semibold">{currency.format(r.running)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
