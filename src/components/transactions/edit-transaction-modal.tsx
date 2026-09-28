"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { trxCode, type TransactionRow } from "@/components/transactions/types";

type Product = { id: string; name: string; category: string; price: number };
type Topping = { id: string; name: string; price: number };
type Approver = { id: string; name: string; role: string };
type EditLine = { key: string; productId: string; qty: number; toppingIds: string[] };

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function lineTotal(line: EditLine, products: Product[], toppings: Topping[]): number {
  const product = products.find((p) => p.id === line.productId);
  if (!product) return 0;
  const toppingsTotal = line.toppingIds.reduce((sum, id) => sum + (toppings.find((t) => t.id === id)?.price ?? 0), 0);
  return (product.price + toppingsTotal) * line.qty;
}

export function EditTransactionModal({
  transaction,
  products,
  toppings,
  onClose,
}: {
  transaction: TransactionRow;
  products: Product[];
  toppings: Topping[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [approverId, setApproverId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [lines, setLines] = useState<EditLine[]>(() =>
    transaction.items.map((item, i) => ({
      key: `${item.id}-${i}`,
      productId: item.productId,
      qty: item.qty,
      toppingIds: item.toppings.flatMap((t) => Array(t.qty).fill(t.toppingId) as string[]),
    })),
  );

  useEffect(() => {
    fetch("/api/users/approvers")
      .then((r) => r.json())
      .then((data) => setApprovers(data.approvers ?? []));
  }, []);

  const total = useMemo(() => lines.reduce((sum, l) => sum + lineTotal(l, products, toppings), 0), [lines, products, toppings]);

  function updateLine(key: string, patch: Partial<EditLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }
  function addLine() {
    const first = products[0];
    if (!first) return;
    setLines((prev) => [...prev, { key: crypto.randomUUID(), productId: first.id, qty: 1, toppingIds: [] }]);
  }
  function toggleTopping(key: string, toppingId: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.key === key
          ? { ...l, toppingIds: l.toppingIds.includes(toppingId) ? l.toppingIds.filter((id) => id !== toppingId) : [...l.toppingIds, toppingId] }
          : l,
      ),
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      // Group same-topping-id occurrences within a line into {toppingId, qty}
      // pairs the API expects (one entry per distinct topping, not repeated).
      const items = lines.map((l) => {
        const toppingCounts = new Map<string, number>();
        for (const id of l.toppingIds) toppingCounts.set(id, (toppingCounts.get(id) ?? 0) + 1);
        return {
          productId: l.productId,
          qty: l.qty,
          toppings: Array.from(toppingCounts.entries()).map(([toppingId, qty]) => ({ toppingId, qty })),
        };
      });

      const res = await fetch(`/api/pos/transactions/${transaction.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          approvalSpvId: approverId,
          items,
          discount: transaction.discount,
          channel: transaction.channel,
          paymentMethod: transaction.channel,
          memberId: transaction.memberId ?? undefined,
          pointsToRedeem: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Gagal mengedit transaksi.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const canSubmit = Boolean(approverId) && reason.trim().length > 0 && lines.length > 0 && !pending;

  // Portal to document.body — see the identical comment in
  // void-transaction-modal.tsx for why a fixed-position modal can't be a
  // descendant of AppShell's animated <main> wrapper.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="animate-fade-in-up flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <Pencil className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Edit Transaksi</p>
              <p className="text-xs text-slate-400">{trxCode(transaction.id)}</p>
            </div>
          </div>
          <button aria-label="Tutup" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <p className="text-xs text-slate-500">
            Transaksi asli akan di-void otomatis dan diganti transaksi baru dengan item hasil edit — riwayat asli tetap
            tersimpan untuk audit.
          </p>

          <div className="space-y-3">
            {lines.map((line) => {
              const product = products.find((p) => p.id === line.productId);
              return (
                <div key={line.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <Select
                      value={line.productId}
                      onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                      className="flex-1"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {currency.format(p.price)}
                        </option>
                      ))}
                    </Select>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Kurangi qty"
                        onClick={() => updateLine(line.key, { qty: Math.max(1, line.qty - 1) })}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{line.qty}</span>
                      <button
                        aria-label="Tambah qty"
                        onClick={() => updateLine(line.key, { qty: line.qty + 1 })}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      aria-label="Hapus item"
                      onClick={() => removeLine(line.key)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {toppings.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {toppings.map((t) => {
                        const active = line.toppingIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => toggleTopping(line.key, t.id)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              active ? "bg-gold-100 text-gold-800 ring-1 ring-inset ring-gold-300" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            + {t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <p className="mt-2 text-right text-xs font-medium text-slate-600">
                    {currency.format(lineTotal(line, products, toppings))}
                  </p>
                  {!product && <p className="mt-1 text-xs text-rose-600">Produk tidak ditemukan.</p>}
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" />
            Tambah Item
          </Button>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-brand-900">
            <span>Total Baru</span>
            <span>{currency.format(Math.max(0, total - transaction.discount))}</span>
          </div>

          <div>
            <Label htmlFor="edit-reason">Alasan Edit</Label>
            <Textarea
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Salah qty saat input"
              rows={2}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-approver">Disetujui oleh (SPV/Master Admin)</Label>
            <Select id="edit-approver" value={approverId} onChange={(e) => setApproverId(e.target.value)} className="mt-1">
              <option value="">Pilih approver</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role.replace("_", " ")})
                </option>
              ))}
            </Select>
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {pending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
