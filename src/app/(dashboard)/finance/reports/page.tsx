import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAccountBalances, getIncomeStatementBalances, ACCOUNT_TYPE_LABELS } from "@/lib/accounting";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AccountList({ rows }: { rows: { code: string; name: string; balance: number }[] }) {
  const nonZero = rows.filter((r) => r.balance !== 0);
  const total = rows.reduce((s, r) => s + r.balance, 0);
  return (
    <>
      <ul className="divide-y divide-slate-100">
        {nonZero.map((r) => (
          <li key={r.code} className="flex items-center justify-between px-5 py-2 text-sm">
            <span className="text-slate-700">
              <span className="mr-2 font-mono text-xs text-slate-400">{r.code}</span>
              {r.name}
            </span>
            <span className="font-medium tabular-nums text-slate-800">{currency.format(r.balance)}</span>
          </li>
        ))}
        {nonZero.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">Belum ada saldo.</li>}
      </ul>
      <div className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-right text-sm font-bold text-brand-900">
        Total: {currency.format(total)}
      </div>
    </>
  );
}

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string; from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const { asOf, from, to } = await searchParams;
  const now = new Date();
  const asOfDate = asOf ? new Date(`${asOf}T23:59:59.999`) : now;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeFrom = from ? new Date(`${from}T00:00:00`) : monthStart;
  const rangeTo = to ? new Date(`${to}T23:59:59.999`) : asOfDate;

  const [neracaBalances, laBaRugiBalances, laBaRugiAllTime] = await Promise.all([
    getAccountBalances(asOfDate),
    getIncomeStatementBalances(rangeFrom, rangeTo),
    // All-time net income up to asOfDate — folded into Ekuitas as "Laba
    // (Rugi) Berjalan" since it hasn't been formally closed to Modal/Laba
    // Ditahan by any period-close step (none exists yet in this v1).
    getIncomeStatementBalances(new Date(2000, 0, 1), asOfDate),
  ]);

  const aset = neracaBalances.filter((r) => r.type === "ASET");
  const kewajiban = neracaBalances.filter((r) => r.type === "KEWAJIBAN");
  const ekuitasRows = neracaBalances.filter((r) => r.type === "EKUITAS");

  const totalAset = aset.reduce((s, r) => s + r.balance, 0);
  const totalKewajiban = kewajiban.reduce((s, r) => s + r.balance, 0);
  const totalEkuitasRecorded = ekuitasRows.reduce((s, r) => s + r.balance, 0);

  const pendapatan = laBaRugiBalances.filter((r) => r.type === "PENDAPATAN");
  const hpp = laBaRugiBalances.filter((r) => r.type === "HARGA_POKOK_PENJUALAN");
  const bebanLangsung = laBaRugiBalances.filter((r) => r.type === "BEBAN_LANGSUNG");
  const bebanOperasional = laBaRugiBalances.filter((r) => r.type === "BEBAN_OPERASIONAL");
  const bebanNonOp = laBaRugiBalances.filter((r) => r.type === "BEBAN_NON_OPERASIONAL");
  const pendapatanNonOp = laBaRugiBalances.filter((r) => r.type === "PENDAPATAN_NON_OPERASIONAL");

  const totalPendapatan = pendapatan.reduce((s, r) => s + r.balance, 0);
  const totalHpp = hpp.reduce((s, r) => s + r.balance, 0);
  const labaKotor = totalPendapatan - totalHpp;
  const totalBebanLangsung = bebanLangsung.reduce((s, r) => s + r.balance, 0);
  const totalBebanOperasional = bebanOperasional.reduce((s, r) => s + r.balance, 0);
  const labaUsaha = labaKotor - totalBebanLangsung - totalBebanOperasional;
  const totalBebanNonOp = bebanNonOp.reduce((s, r) => s + r.balance, 0);
  const totalPendapatanNonOp = pendapatanNonOp.reduce((s, r) => s + r.balance, 0);
  const labaBersih = labaUsaha + totalPendapatanNonOp - totalBebanNonOp;

  const labaBerjalanAllTime = laBaRugiAllTime.reduce((s, r) => {
    if (r.type === "PENDAPATAN" || r.type === "PENDAPATAN_NON_OPERASIONAL") return s + r.balance;
    return s - r.balance;
  }, 0);
  const totalEkuitas = totalEkuitasRecorded + labaBerjalanAllTime;
  const totalKewajibanEkuitas = totalKewajiban + totalEkuitas;
  const isBalanced = Math.abs(totalAset - totalKewajibanEkuitas) < 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Keuangan"
        description="Neraca (per tanggal) dan Laba Rugi (per periode) — dihitung langsung dari seluruh jurnal yang sudah diposting."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filter Periode</CardTitle>
        </CardHeader>
        <form className="flex flex-wrap items-end gap-3 p-5 pt-0">
          <div>
            <Label className="text-[11px]">Neraca per Tanggal</Label>
            <Input type="date" name="asOf" defaultValue={localDateStr(asOfDate)} max={localDateStr(now)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Laba Rugi Dari</Label>
            <Input type="date" name="from" defaultValue={localDateStr(rangeFrom)} max={localDateStr(now)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Laba Rugi Sampai</Label>
            <Input type="date" name="to" defaultValue={localDateStr(rangeTo)} max={localDateStr(now)} className="mt-1" />
          </div>
          <Button type="submit" variant="secondary">
            Tampilkan
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="rounded-t-xl bg-brand-950 px-5 py-3">
          <p className="text-sm font-bold uppercase tracking-wide text-white">
            Laba Rugi — {rangeFrom.toLocaleDateString("id-ID")} s/d {rangeTo.toLocaleDateString("id-ID")}
          </p>
        </div>
        <Table>
          <Thead>
            <tr>
              <Th>Pos</Th>
              <Th className="text-right">Nominal</Th>
            </tr>
          </Thead>
          <tbody>
            <Tr>
              <Td className="font-bold text-slate-900">{ACCOUNT_TYPE_LABELS.PENDAPATAN}</Td>
              <Td className="text-right font-bold">{currency.format(totalPendapatan)}</Td>
            </Tr>
            {pendapatan.filter((r) => r.balance !== 0).map((r) => (
              <Tr key={r.code}>
                <Td className="pl-8 text-slate-600">{r.name}</Td>
                <Td className="text-right">{currency.format(r.balance)}</Td>
              </Tr>
            ))}
            <Tr>
              <Td className="font-bold text-slate-900">(-) {ACCOUNT_TYPE_LABELS.HARGA_POKOK_PENJUALAN}</Td>
              <Td className="text-right font-bold">({currency.format(totalHpp)})</Td>
            </Tr>
            <Tr className="bg-amber-50">
              <Td className="font-bold text-brand-900">Laba Kotor</Td>
              <Td className="text-right font-bold text-brand-900">{currency.format(labaKotor)}</Td>
            </Tr>
            <Tr>
              <Td className="font-bold text-slate-900">(-) {ACCOUNT_TYPE_LABELS.BEBAN_LANGSUNG}</Td>
              <Td className="text-right font-bold">({currency.format(totalBebanLangsung)})</Td>
            </Tr>
            <Tr>
              <Td className="font-bold text-slate-900">(-) {ACCOUNT_TYPE_LABELS.BEBAN_OPERASIONAL}</Td>
              <Td className="text-right font-bold">({currency.format(totalBebanOperasional)})</Td>
            </Tr>
            {bebanOperasional.filter((r) => r.balance !== 0).map((r) => (
              <Tr key={r.code}>
                <Td className="pl-8 text-slate-600">{r.name}</Td>
                <Td className="text-right">({currency.format(r.balance)})</Td>
              </Tr>
            ))}
            <Tr className="bg-amber-50">
              <Td className="font-bold text-brand-900">Laba Usaha</Td>
              <Td className="text-right font-bold text-brand-900">{currency.format(labaUsaha)}</Td>
            </Tr>
            <Tr>
              <Td className="text-slate-600">(+) {ACCOUNT_TYPE_LABELS.PENDAPATAN_NON_OPERASIONAL}</Td>
              <Td className="text-right">{currency.format(totalPendapatanNonOp)}</Td>
            </Tr>
            <Tr>
              <Td className="text-slate-600">(-) {ACCOUNT_TYPE_LABELS.BEBAN_NON_OPERASIONAL}</Td>
              <Td className="text-right">({currency.format(totalBebanNonOp)})</Td>
            </Tr>
            <Tr className={labaBersih >= 0 ? "bg-emerald-500" : "bg-rose-500"}>
              <Td className="font-bold text-white">Laba (Rugi) Bersih</Td>
              <Td className="text-right text-lg font-bold text-white">{currency.format(labaBersih)}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden p-0">
          <div className="rounded-t-xl bg-brand-950 px-5 py-3">
            <p className="text-sm font-bold uppercase tracking-wide text-white">Neraca — Aset</p>
          </div>
          <AccountList rows={aset} />
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="rounded-t-xl bg-brand-950 px-5 py-3">
            <p className="text-sm font-bold uppercase tracking-wide text-white">Neraca — Kewajiban</p>
          </div>
          <AccountList rows={kewajiban} />
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="rounded-t-xl bg-brand-950 px-5 py-3">
            <p className="text-sm font-bold uppercase tracking-wide text-white">Neraca — Ekuitas</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {ekuitasRows.filter((r) => r.balance !== 0).map((r) => (
              <li key={r.code} className="flex items-center justify-between px-5 py-2 text-sm">
                <span className="text-slate-700">
                  <span className="mr-2 font-mono text-xs text-slate-400">{r.code}</span>
                  {r.name}
                </span>
                <span className="font-medium tabular-nums text-slate-800">{currency.format(r.balance)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between px-5 py-2 text-sm">
              <span className="text-slate-700">Laba (Rugi) Berjalan (belum ditutup)</span>
              <span className="font-medium tabular-nums text-slate-800">{currency.format(labaBerjalanAllTime)}</span>
            </li>
          </ul>
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-right text-sm font-bold text-brand-900">
            Total: {currency.format(totalEkuitas)}
          </div>
        </Card>
      </div>

      <Card className={isBalanced ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total Aset</p>
            <p className="text-xl font-bold text-brand-900">{currency.format(totalAset)}</p>
          </div>
          <div className="text-2xl text-slate-300">=</div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total Kewajiban + Ekuitas</p>
            <p className="text-xl font-bold text-brand-900">{currency.format(totalKewajibanEkuitas)}</p>
          </div>
          <div className={`ml-auto rounded-full px-3 py-1.5 text-xs font-bold ${isBalanced ? "bg-emerald-200 text-emerald-800" : "bg-rose-200 text-rose-800"}`}>
            {isBalanced ? "✓ Neraca Seimbang" : "⚠ Neraca Tidak Seimbang"}
          </div>
        </div>
      </Card>
    </div>
  );
}
