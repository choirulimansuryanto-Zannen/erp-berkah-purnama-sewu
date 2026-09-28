"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ListOrdered, Pencil, Printer, Search, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChannelBadge, CHANNEL_LABELS } from "@/components/transactions/channel-badge";
import { printReceipt } from "@/components/transactions/print-receipt";
import { VoidTransactionModal } from "@/components/transactions/void-transaction-modal";
import { EditTransactionModal } from "@/components/transactions/edit-transaction-modal";
import { trxCode, type TransactionRow } from "@/components/transactions/types";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

type Product = { id: string; name: string; category: string; price: number };
type Topping = { id: string; name: string; price: number };

const CHANNEL_FILTERS = ["GOFOOD", "GRAB", "SHOPEE", "CASH", "QPON", "CASHLESS", "TIKTOK"];

export function TransactionCardList({
  transactions,
  showDate,
  products,
  toppings,
}: {
  transactions: TransactionRow[];
  showDate: boolean;
  products: Product[];
  toppings: Topping[];
}) {
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<TransactionRow | null>(null);
  const [editTarget, setEditTarget] = useState<TransactionRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (channelFilter && t.channel !== channelFilter) return false;
      if (!q) return true;
      return (
        trxCode(t.id).toLowerCase().includes(q) ||
        (t.memberName?.toLowerCase().includes(q) ?? false) ||
        t.itemsSummary.toLowerCase().includes(q)
      );
    });
  }, [transactions, query, channelFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari No Transaksi, Member, atau Produk..."
            className="field-glow w-full rounded-lg border border-slate-300 bg-slate-50/60 py-2.5 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-accent-500 focus:bg-white focus:outline-none"
          />
        </div>
        <button
          onClick={() => setChannelFilter(null)}
          className={`rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
            channelFilter === null ? "bg-brand-900 text-gold-300" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          Semua Channel
        </button>
        {CHANNEL_FILTERS.map((c) => (
          <button
            key={c}
            onClick={() => setChannelFilter((prev) => (prev === c ? null : c))}
            className={`rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
              channelFilter === c ? "bg-brand-900 text-gold-300" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {CHANNEL_LABELS[c] ?? c}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/70">
        <div className="flex items-center gap-2 bg-brand-900 px-5 py-3">
          <ListOrdered className="h-4 w-4 text-gold-400" />
          <p className="text-sm font-bold uppercase tracking-wide text-white">
            Daftar Transaksi Penjualan ({filtered.length})
          </p>
          <p className="ml-auto text-xs text-white/50">Urut berdasarkan waktu terbaru</p>
        </div>

        <div className="divide-y divide-slate-100 bg-white">
          {filtered.map((t) => (
            <div key={t.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-slate-200 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                    {trxCode(t.id)}
                  </span>
                  <ChannelBadge channel={t.channel} />
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {new Date(t.time).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: showDate ? "numeric" : undefined,
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Kasir: {t.kasirName}
                  {t.memberName && <span className="text-slate-400">· Member: {t.memberName}</span>}
                </p>

                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Item Pesanan ({t.itemCount} porsi):
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {t.items.map((item) => (
                      <li key={item.id}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-700">
                            <span className="font-semibold text-slate-900">{item.qty}x</span> {item.productName}
                          </span>
                          <span className="shrink-0 font-mono text-slate-600">{currency.format(item.unitPrice * item.qty)}</span>
                        </div>
                        {item.toppings.map((tp) => (
                          <div key={tp.toppingId} className="flex items-center justify-between gap-3 pl-4 text-xs text-accent-700">
                            <span>+ {tp.toppingName} ({tp.qty}x)</span>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total Transaksi</p>
                  <p className="text-xl font-bold text-accent-700">{currency.format(t.total)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => printReceipt(t)}>
                    <Printer className="h-3.5 w-3.5" />
                    Cetak Struk
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditTarget(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setVoidTarget(t)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="px-5 py-14 text-center text-sm text-slate-400">
              {query || channelFilter ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi."}
            </p>
          )}
        </div>
      </div>

      {voidTarget && <VoidTransactionModal transaction={voidTarget} onClose={() => setVoidTarget(null)} />}
      {editTarget && (
        <EditTransactionModal transaction={editTarget} products={products} toppings={toppings} onClose={() => setEditTarget(null)} />
      )}
    </div>
  );
}
