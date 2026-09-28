"use client";

import { Fragment, useMemo, useState } from "react";
import { Diamond, Search, UserPlus, UserX, X } from "lucide-react";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { RankedBarChart } from "@/components/transactions/ranked-bar-chart";
import { ShareDonutChart } from "@/components/transactions/share-donut-chart";
import { PeriodTrendChart } from "@/components/transactions/period-trend-chart";
import { CHANNEL_COLORS, CHANNEL_LABELS, ChannelBadge } from "@/components/transactions/channel-badge";
import { TransactionCardList } from "@/components/transactions/transaction-card-list";
import type { TransactionRow as FullTransactionRow } from "@/components/transactions/types";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const RANK_BADGE = [
  "bg-gold-100 text-gold-800 ring-1 ring-inset ring-gold-300",
  "bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300",
  "bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-300",
];
const ROW_TINT = ["bg-gold-50/40", "bg-slate-50", "bg-orange-50/40"];

const SEGMENT_LABEL: Record<"LOYALTY" | "NON_MEMBER" | "NEW_REGISTER", string> = {
  LOYALTY: "Member Loyalty",
  NON_MEMBER: "Non-Member / Umum",
  NEW_REGISTER: "New Member Register",
};

function RankBadge({ rank }: { rank: number }) {
  const cls = RANK_BADGE[rank - 1] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${cls}`}>{rank}</span>
  );
}

// A value rendered with a proportional tinted bar behind it — an inline
// "chart in the table" so the ranking reads at a glance without needing to
// look away to the chart above.
function MetricCell({ value, max, color, children }: { value: number; max: number; color: string; children: React.ReactNode }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 3) : 0;
  return (
    <div className="relative py-1">
      <div className="absolute inset-y-0 left-0 rounded-md opacity-[0.12]" style={{ width: `${pct}%`, backgroundColor: color }} />
      <span className="relative font-semibold text-slate-900">{children}</span>
    </div>
  );
}

type ChannelBreakdown = { channel: string; omset: number; orders: number; aov: number };
type ModelBreakdown = { model: string; omset: number; orders: number; aov: number };
type ModelGroup = ModelBreakdown & { channels: ChannelBreakdown[] };

const MODEL_ACCENT: Record<string, string> = {
  Offline: "#d92a1c",
  Online: "#f2b000",
  Tunai: "#d92a1c",
  "Non-Tunai": "#f2b000",
};

// Per Customer Model / Per Payment Model's detail view: every channel
// listed under whichever model it belongs to, closed off by a subtotal row
// — same table chrome as Per Channel (ChannelBadge, the inline proportional
// bar in MetricCell) so it reads as one family of tables rather than a
// bolted-on second style, with a small colored dot + label standing in for
// a section header instead of a heavy divider bar.
function ModelGroupTable({ groups, modelLabel }: { groups: ModelGroup[]; modelLabel: string }) {
  const maxOmset = Math.max(...groups.flatMap((g) => g.channels.map((c) => c.omset)), 1);
  return (
    <Table>
      <Thead>
        <tr>
          <Th>{modelLabel}</Th>
          <Th>Omset</Th>
          <Th>Jumlah Pesanan</Th>
          <Th>AOV</Th>
        </tr>
      </Thead>
      <tbody>
        {groups.map((g) => {
          const accent = MODEL_ACCENT[g.model] ?? "#64748b";
          return (
            <Fragment key={g.model}>
              <tr>
                <td colSpan={4} className="px-5 pb-1.5 pt-4 first:pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                    {g.model}
                  </span>
                </td>
              </tr>
              {g.channels.map((c) => (
                <Tr key={c.channel}>
                  <Td>
                    <ChannelBadge channel={c.channel} />
                  </Td>
                  <Td>
                    <MetricCell value={c.omset} max={maxOmset} color={CHANNEL_COLORS[c.channel] ?? accent}>
                      {currency.format(c.omset)}
                    </MetricCell>
                  </Td>
                  <Td>{c.orders}</Td>
                  <Td>{currency.format(c.aov)}</Td>
                </Tr>
              ))}
              <tr className="border-y border-slate-200 bg-slate-50/80">
                <td className="px-5 py-2.5 text-sm font-bold text-slate-700">Total {g.model}</td>
                <td className="px-5 py-2.5 text-sm font-bold text-slate-900">{currency.format(g.omset)}</td>
                <td className="px-5 py-2.5 text-sm font-bold text-slate-900">{g.orders}</td>
                <td className="px-5 py-2.5 text-sm font-bold text-slate-900">{currency.format(g.aov)}</td>
              </tr>
            </Fragment>
          );
        })}
      </tbody>
    </Table>
  );
}
type MemberBreakdown = { memberId: string; name: string; omset: number; orders: number; aov: number };
type MemberSegments = {
  loyalty: { omset: number; orders: number; aov: number; activeMembers: number };
  nonMember: { omset: number; orders: number; aov: number };
  newRegister: { omset: number; orders: number; aov: number };
};
type ProductBreakdown = {
  productId: string;
  name: string;
  omset: number;
  qty: number;
  aov: number;
  channels: { channel: string; qty: number; omset: number }[];
};
type PeriodPoint = { label: string; omset: number; orders: number };
type Product = { id: string; name: string; category: string; price: number };
type Topping = { id: string; name: string; price: number };

const TABS = [
  "Per Channel",
  "Per Customer Model",
  "Per Payment Model",
  "Per Produk",
  "Per Member",
  "Per Transaksi",
] as const;

export function HistoryTabs({
  byChannel,
  byCustomerModel,
  byPaymentModel,
  customerModelGroups,
  paymentModelGroups,
  byProduct,
  byMember,
  memberSegments,
  byPeriod,
  transactions,
  showDate = false,
  products,
  toppings,
}: {
  byChannel: ChannelBreakdown[];
  byCustomerModel: ModelBreakdown[];
  byPaymentModel: ModelBreakdown[];
  customerModelGroups: ModelGroup[];
  paymentModelGroups: ModelGroup[];
  byProduct: ProductBreakdown[];
  byMember: MemberBreakdown[];
  memberSegments: MemberSegments;
  byPeriod: PeriodPoint[];
  transactions: FullTransactionRow[];
  showDate?: boolean;
  products: Product[];
  toppings: Topping[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Per Channel");
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<FullTransactionRow["segment"] | null>(null);

  const segmentTransactions = useMemo(
    () => (selectedSegment ? transactions.filter((t) => t.segment === selectedSegment) : []),
    [transactions, selectedSegment],
  );

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return byMember;
    return byMember.filter((m) => m.name.toLowerCase().includes(q));
  }, [byMember, memberQuery]);

  const maxChannelOmset = Math.max(...byChannel.map((c) => c.omset), 1);
  const topProducts = byProduct.slice(0, 10);
  const topMembers = byMember.slice(0, 10);
  const maxMemberOrders = Math.max(...topMembers.map((m) => m.orders), 1);

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-brand-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pt-5">
        {tab === "Per Channel" && (
          <div className="space-y-5">
            <RankedBarChart
              data={byChannel.map((c) => ({ name: CHANNEL_LABELS[c.channel] ?? c.channel, value: c.omset, color: CHANNEL_COLORS[c.channel] }))}
              valueFormatter={(v) => currency.format(v)}
            />
            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>Channel</Th>
                  <Th>Omset</Th>
                  <Th>Jumlah Pesanan</Th>
                  <Th>AOV</Th>
                </tr>
              </Thead>
              <tbody>
                {byChannel.map((c, i) => (
                  <Tr key={c.channel} className={ROW_TINT[i] ?? undefined}>
                    <Td>
                      <RankBadge rank={i + 1} />
                    </Td>
                    <Td>
                      <ChannelBadge channel={c.channel} />
                    </Td>
                    <Td>
                      <MetricCell value={c.omset} max={maxChannelOmset} color={CHANNEL_COLORS[c.channel] ?? "#d92a1c"}>
                        {currency.format(c.omset)}
                      </MetricCell>
                    </Td>
                    <Td>{c.orders}</Td>
                    <Td>{currency.format(c.aov)}</Td>
                  </Tr>
                ))}
                {byChannel.length === 0 && <EmptyRow colSpan={5}>Belum ada transaksi.</EmptyRow>}
              </tbody>
            </Table>
          </div>
        )}

        {tab === "Per Customer Model" && (
          <div className="space-y-5">
            <ShareDonutChart
              data={byCustomerModel.map((m) => ({ name: m.model, value: m.omset, color: m.model === "Online" ? "#f2b000" : "#d92a1c" }))}
              valueFormatter={(v) => currency.format(v)}
              centerLabel="Total Omset"
            />
            <ModelGroupTable groups={customerModelGroups} modelLabel="Model / Channel" />
          </div>
        )}

        {tab === "Per Payment Model" && (
          <div className="space-y-5">
            <ShareDonutChart
              data={byPaymentModel.map((m) => ({ name: m.model, value: m.omset, color: m.model === "Tunai" ? "#d92a1c" : "#f2b000" }))}
              valueFormatter={(v) => currency.format(v)}
              centerLabel="Total Omset"
            />
            <ModelGroupTable groups={paymentModelGroups} modelLabel="Model Pembayaran / Channel" />
          </div>
        )}

        {tab === "Per Produk" && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Top 10 Produk Terlaris (Qty)</p>
              <RankedBarChart
                data={topProducts.map((p) => ({ name: p.name, value: p.qty }))}
                valueFormatter={(v) => `${v} pcs`}
              />
            </div>
            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>Produk</Th>
                  <Th>Qty Terjual</Th>
                  <Th>Omset</Th>
                  <Th>Rata-rata Harga</Th>
                  <Th>Rincian Channel</Th>
                </tr>
              </Thead>
              <tbody>
                {byProduct.map((p, i) => (
                  <Tr key={p.productId} className={ROW_TINT[i] ?? undefined}>
                    <Td>
                      <RankBadge rank={i + 1} />
                    </Td>
                    <Td className="font-medium text-slate-900">{p.name}</Td>
                    <Td>
                      <MetricCell value={p.qty} max={byProduct[0]?.qty ?? 1} color="#d92a1c">
                        {p.qty}
                      </MetricCell>
                    </Td>
                    <Td>{currency.format(p.omset)}</Td>
                    <Td>{currency.format(p.aov)}</Td>
                    <Td className="text-xs text-slate-500">
                      {p.channels.map((c) => `${c.channel} ×${c.qty}`).join(" · ")}
                    </Td>
                  </Tr>
                ))}
                {byProduct.length === 0 && <EmptyRow colSpan={6}>Belum ada transaksi.</EmptyRow>}
              </tbody>
            </Table>
          </div>
        )}

        {tab === "Per Member" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setSelectedSegment((s) => (s === "LOYALTY" ? null : "LOYALTY"))}
                className={`rounded-xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-purple-100 p-4 text-left transition-shadow hover:shadow-[var(--shadow-card-hover)] ${
                  selectedSegment === "LOYALTY" ? "ring-2 ring-purple-400 ring-offset-2" : ""
                }`}
              >
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-purple-800">
                  <Diamond className="h-3.5 w-3.5" />
                  Transaksi Member Loyalty
                </p>
                <p className="mt-2 text-2xl font-bold text-purple-900">{currency.format(memberSegments.loyalty.omset)}</p>
                <p className="mt-1 text-xs font-medium text-purple-700">
                  {memberSegments.loyalty.activeMembers} member aktif belanja
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-purple-200/70 pt-2.5 text-xs font-semibold text-purple-800">
                  <span>{memberSegments.loyalty.orders} Trx</span>
                  <span>AOV {currency.format(memberSegments.loyalty.aov)}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSegment((s) => (s === "NON_MEMBER" ? null : "NON_MEMBER"))}
                className={`rounded-xl border border-slate-200 bg-slate-100 p-4 text-left transition-shadow hover:shadow-[var(--shadow-card-hover)] ${
                  selectedSegment === "NON_MEMBER" ? "ring-2 ring-slate-400 ring-offset-2" : ""
                }`}
              >
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <UserX className="h-3.5 w-3.5" />
                  Transaksi Non-Member / Umum
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency.format(memberSegments.nonMember.omset)}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Pelanggan tanpa keanggotaan loyalty</p>
                <div className="mt-3 flex items-center justify-between border-t border-slate-300/70 pt-2.5 text-xs font-semibold text-slate-600">
                  <span>{memberSegments.nonMember.orders} Trx</span>
                  <span>AOV {currency.format(memberSegments.nonMember.aov)}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSegment((s) => (s === "NEW_REGISTER" ? null : "NEW_REGISTER"))}
                className={`rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-4 text-left transition-shadow hover:shadow-[var(--shadow-card-hover)] ${
                  selectedSegment === "NEW_REGISTER" ? "ring-2 ring-emerald-400 ring-offset-2" : ""
                }`}
              >
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800">
                  <UserPlus className="h-3.5 w-3.5" />
                  Transaksi New Member Register
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-900">{memberSegments.newRegister.orders} Trx</p>
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  Omset dari member baru daftar: {currency.format(memberSegments.newRegister.omset)}
                </p>
              </button>
            </div>

            {selectedSegment && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">
                    Rincian Transaksi — {SEGMENT_LABEL[selectedSegment]} ({segmentTransactions.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedSegment(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <TransactionCardList transactions={segmentTransactions} showDate={showDate} products={products} toppings={toppings} />
              </div>
            )}

            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Cari nama member..."
                className="field-glow w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-accent-500 focus:outline-none"
              />
            </div>

            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>Member</Th>
                  <Th>Jumlah Pesanan</Th>
                  <Th>Omset</Th>
                  <Th>AOV</Th>
                </tr>
              </Thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const i = byMember.indexOf(m);
                  return (
                    <Tr key={m.memberId} className={ROW_TINT[i] ?? undefined}>
                      <Td>
                        <RankBadge rank={i + 1} />
                      </Td>
                      <Td className="font-medium text-slate-900">{m.name}</Td>
                      <Td>
                        <MetricCell value={m.orders} max={maxMemberOrders} color="#d19400">
                          {m.orders}
                        </MetricCell>
                      </Td>
                      <Td>{currency.format(m.omset)}</Td>
                      <Td>{currency.format(m.aov)}</Td>
                    </Tr>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <EmptyRow colSpan={5}>{memberQuery ? "Tidak ada member yang cocok." : "Belum ada transaksi member."}</EmptyRow>
                )}
              </tbody>
            </Table>
          </div>
        )}

        {tab === "Per Transaksi" && (
          <div className="space-y-5">
            <PeriodTrendChart data={byPeriod} />
            <TransactionCardList transactions={transactions} showDate={showDate} products={products} toppings={toppings} />
          </div>
        )}
      </div>
    </div>
  );
}
