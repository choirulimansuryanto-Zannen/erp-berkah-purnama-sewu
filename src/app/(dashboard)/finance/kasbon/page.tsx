import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Wallet, Users2, Receipt, AlertTriangle } from "lucide-react";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

// The business's own plafond rule — Rp400.000 kasbon per pramuniaga per
// bulan, with a soft warning once someone crosses Rp350.000 (no hard block
// here, this is a finance-side monitoring report, not the kasbon-request
// form itself — but see the note under the alert card for where that'd hook in).
const PLAFOND_MAX = 400_000;
const PLAFOND_WARNING = 350_000;

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Status = "normal" | "warning" | "exceeded";
function statusFor(total: number): Status {
  if (total >= PLAFOND_MAX) return "exceeded";
  if (total >= PLAFOND_WARNING) return "warning";
  return "normal";
}

// Kasbon Pramuniaga — every kasbon a pramuniaga has pulled against their own
// outlet's setoran, with a running plafond check (Rp400rb/bulan per orang,
// Rp350rb+ triggers a countdown warning). Sits above Laporan Outlet in the
// menu since its own "Summary Setoran Bersih" Kasbon column is this same
// data, already netted — this page is where that figure is explained line
// by line and checked against the plafond rule.
export default async function KasbonPramuniagaPage({
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
  const isSingleCalendarMonth = rangeFrom.getFullYear() === rangeTo.getFullYear() && rangeFrom.getMonth() === rangeTo.getMonth();

  const kasbonRows = await prisma.kasbon.findMany({
    where: { date: { gte: rangeFrom, lte: rangeTo } },
    include: { pramuniagaRoster: true, pramuniaga: true, outlet: { include: { region: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const rows = kasbonRows.map((k) => ({
    id: k.id,
    // Same resolution the pramuniaga's own Rekap Summary uses (setoran-page):
    // the specific roster member who actually requested it when recorded,
    // falling back to whoever's logged-in account it was filed under.
    personKey: k.pramuniagaRosterId ?? k.pramuniagaId,
    pramuniagaName: k.pramuniagaRoster?.name ?? k.pramuniaga.name,
    date: k.date,
    outletName: k.outlet.name,
    regionName: k.outlet.region.name,
    amount: Number(k.amount),
    notes: k.notes,
  }));

  const summaryMap = new Map<string, { name: string; total: number; count: number }>();
  for (const r of rows) {
    const entry = summaryMap.get(r.personKey) ?? { name: r.pramuniagaName, total: 0, count: 0 };
    entry.total += r.amount;
    entry.count += 1;
    summaryMap.set(r.personKey, entry);
  }
  const summary = [...summaryMap.values()].sort((a, b) => b.total - a.total);

  const totalKasbon = rows.reduce((s, r) => s + r.amount, 0);
  const exceededCount = summary.filter((s) => statusFor(s.total) === "exceeded").length;
  const warningCount = summary.filter((s) => statusFor(s.total) === "warning").length;

  const STATUS_LABEL: Record<Status, string> = { normal: "Aman", warning: "Mendekati Batas", exceeded: "Melebihi Plafond" };
  const STATUS_TONE: Record<Status, "success" | "warning" | "danger"> = { normal: "success", warning: "warning", exceeded: "danger" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kasbon Pramuniaga"
        description="Rincian setiap kasbon yang memotong setoran outlet, per pramuniaga — dasar kolom Kasbon di Summary Setoran Bersih."
        actions={<DateRangeFilter from={localDateStr(rangeFrom)} to={localDateStr(rangeTo)} />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Kasbon (periode ini)" value={currency.format(totalKasbon)} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Jumlah Transaksi" value={String(rows.length)} tone="neutral" icon={<Receipt className="h-4 w-4" />} />
        <StatCard label="Jumlah Pramuniaga" value={String(summary.length)} tone="info" icon={<Users2 className="h-4 w-4" />} />
        <StatCard
          label="Melebihi / Mendekati Plafond"
          value={`${exceededCount} / ${warningCount}`}
          tone={exceededCount > 0 ? "danger" : warningCount > 0 ? "warning" : "success"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      {!isSingleCalendarMonth && (
        <div className="rounded-lg border border-slate-200/70 bg-white px-4 py-2.5 text-xs text-slate-500">
          Periode yang dipilih mencakup lebih dari satu bulan kalender — total pada tabel di bawah menjumlahkan seluruh periode ini,
          sedangkan plafond Rp400.000 sendiri berlaku <span className="font-semibold">per bulan</span>. Pilih rentang dalam satu bulan
          untuk pengecekan plafond yang paling akurat.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rincian Kasbon ({rows.length})</CardTitle>
        </CardHeader>
        <Table wrapperClassName="max-h-[60vh] overflow-y-auto">
          <Thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <Th>Nama Pramuniaga</Th>
              <Th>Tanggal</Th>
              <Th>Outlet</Th>
              <Th>Wilayah</Th>
              <Th className="text-right">Nominal</Th>
              <Th>Catatan</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-slate-900">{r.pramuniagaName}</Td>
                <Td>{r.date.toLocaleDateString("id-ID")}</Td>
                <Td>{r.outletName}</Td>
                <Td>{r.regionName}</Td>
                <Td className="text-right font-semibold">{currency.format(r.amount)}</Td>
                <Td className="text-xs text-slate-400">{r.notes ?? "-"}</Td>
              </Tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6}>Belum ada kasbon tercatat pada periode ini.</EmptyRow>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-brand-900">
                <td className="px-5 py-2.5" colSpan={4}>
                  Total
                </td>
                <td className="px-5 py-2.5 text-right">{currency.format(totalKasbon)}</td>
                <td className="px-5 py-2.5"></td>
              </tr>
            </tfoot>
          )}
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary Total Kasbon per Pramuniaga ({summary.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama Pramuniaga</Th>
              <Th className="text-right">Jml Transaksi</Th>
              <Th className="text-right">Total Kasbon</Th>
              <Th>Penggunaan Plafond (Rp400.000)</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <tbody>
            {summary.map((s) => {
              const status = statusFor(s.total);
              const pct = Math.min(100, (s.total / PLAFOND_MAX) * 100);
              const barColor = status === "exceeded" ? "bg-rose-500" : status === "warning" ? "bg-amber-500" : "bg-emerald-500";
              return (
                <Tr key={s.name + s.total}>
                  <Td className="font-medium text-slate-900">{s.name}</Td>
                  <Td className="text-right">{s.count}</Td>
                  <Td className="text-right font-semibold">{currency.format(s.total)}</Td>
                  <Td className="min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right text-[11px] text-slate-400">{pct.toFixed(0)}%</span>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                  </Td>
                </Tr>
              );
            })}
            {summary.length === 0 && <EmptyRow colSpan={5}>Belum ada kasbon tercatat pada periode ini.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      {(exceededCount > 0 || warningCount > 0) && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Alert Kasbon — Batas maksimal kasbon Rp400.000 per pramuniaga per bulan
            </CardTitle>
          </CardHeader>
          <div className="space-y-2 p-5 pt-0">
            {summary
              .filter((s) => statusFor(s.total) !== "normal")
              .map((s) => {
                const status = statusFor(s.total);
                const remaining = Math.max(0, PLAFOND_MAX - s.total);
                return (
                  <div
                    key={s.name}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-sm ${
                      status === "exceeded" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    <span className="font-semibold">{s.name}</span>
                    {status === "exceeded" ? (
                      <span>
                        Sudah melebihi plafond bulanan — total kasbon {currency.format(s.total)}, melebihi batas {currency.format(PLAFOND_MAX)}{" "}
                        sebesar {currency.format(s.total - PLAFOND_MAX)}.
                      </span>
                    ) : (
                      <span>
                        Sudah mencapai {currency.format(s.total)} dari batas {currency.format(PLAFOND_MAX)} — sisa plafond bulan ini tinggal{" "}
                        <span className="font-bold">{currency.format(remaining)}</span>.
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </Card>
      )}
    </div>
  );
}
