"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { trxCode, type TransactionRow } from "@/components/transactions/types";

type Approver = { id: string; name: string; role: string };

export function VoidTransactionModal({ transaction, onClose }: { transaction: TransactionRow; onClose: () => void }) {
  const router = useRouter();
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [approverId, setApproverId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/users/approvers")
      .then((r) => r.json())
      .then((data) => setApprovers(data.approvers ?? []));
  }, []);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/pos/transactions/${transaction.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, approvalSpvId: approverId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Gagal menghapus transaksi.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const canSubmit = Boolean(approverId) && reason.trim().length > 0 && !pending;

  // Rendered into document.body via a portal — a fixed-position modal
  // nested inside the page-transition wrapper (AppShell's animate-fade-in-up
  // on <main>) would otherwise compute "fixed" relative to that transformed
  // ancestor instead of the viewport (any CSS transform on an ancestor
  // becomes the containing block for position:fixed descendants), landing
  // the modal thousands of pixels down a long page instead of centered.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="animate-fade-in-up w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Hapus Transaksi</p>
              <p className="text-xs text-slate-400">{trxCode(transaction.id)}</p>
            </div>
          </div>
          <button aria-label="Tutup" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Transaksi akan ditandai VOID dan dibuatkan transaksi pembalik — riwayat asli tetap tersimpan untuk audit,
          poin member (jika ada) otomatis dikembalikan.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="void-reason">Alasan</Label>
            <Textarea
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Salah input produk"
              rows={2}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="void-approver">Disetujui oleh (SPV/Master Admin)</Label>
            <Select id="void-approver" value={approverId} onChange={(e) => setApproverId(e.target.value)} className="mt-1">
              <option value="">Pilih approver</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role.replace("_", " ")})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button variant="danger" onClick={submit} disabled={!canSubmit}>
            {pending ? "Menghapus..." : "Hapus Transaksi"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
