import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { signedBalance } from "@/lib/accounting";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function FinanceLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const { accountId, from, to } = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeFrom = from ? new Date(`${from}T00:00:00`) : defaultFrom;
  const rangeTo = to ? new Date(`${to}T23:59:59.999`) : now;

  const accounts = await prisma.chartOfAccount.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });
  const selectedAccount = accountId ? (accounts.find((a) => a.id === accountId) ?? accounts[0]) : accounts[0];

  const [openingLines, periodLines] = await Promise.all([
    selectedAccount
      ? prisma.journalEntryLine.findMany({
          where: { accountId: selectedAccount.id, journalEntry: { status: "POSTED", date: { lt: rangeFrom } } },
          select: { debit: true, credit: true },
        })
      : Promise.resolve([]),
    selectedAccount
      ? prisma.journalEntryLine.findMany({
          where: { accountId: selectedAccount.id, journalEntry: { status: "POSTED", date: { gte: rangeFrom, lte: rangeTo } } },
          include: { journalEntry: true },
          orderBy: [{ journalEntry: { date: "asc" } }],
        })
      : Promise.resolve([]),
  ]);

  const openingBalance = selectedAccount
    ? signedBalance(
        openingLines.reduce((s, l) => s + Number(l.debit), 0),
        openingLines.reduce((s, l) => s + Number(l.credit), 0),
        selectedAccount.normalBalance,
      )
    : 0;

  let running = openingBalance;
  const rows = periodLines.map((l) => {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    running += signedBalance(debit, credit, selectedAccount!.normalBalance);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buku Besar"
        description="Mutasi per akun — saldo awal, mutasi debit/kredit, dan saldo berjalan."
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div className="min-w-[260px]">
            <Label className="text-[11px]">Pilih Akun</Label>
            <Select name="accountId" defaultValue={selectedAccount?.id} className="mt-1">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
          </div>
          <input type="hidden" name="from" value={localDateStr(rangeFrom)} />
          <input type="hidden" name="to" value={localDateStr(rangeTo)} />
          <Button type="submit" variant="secondary">
            Tampilkan
          </Button>
        </form>
      </Card>

      {selectedAccount && (
        <Card className="overflow-hidden p-0">
          <CardHeader>
            <CardTitle>
              {selectedAccount.code} — {selectedAccount.name}
            </CardTitle>
          </CardHeader>
          <Table>
            <Thead>
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
              {rows.length === 0 && <EmptyRow colSpan={6}>Tidak ada mutasi pada periode ini.</EmptyRow>}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
