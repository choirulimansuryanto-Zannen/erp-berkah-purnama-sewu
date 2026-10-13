"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CASH_BOOK_LABELS, JOURNAL_ENTRY_TYPE_LABELS } from "@/lib/accounting-labels";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export type JournalEntryRow = {
  id: string;
  entryNumber: string;
  date: string;
  cashBook: string | null;
  entryType: string;
  description: string;
  reference: string | null;
  status: string;
  outletName: string | null;
  amount: number;
  cashLine: string;
  contraLine: string;
  // Set when contraLine is still the Buku Kas's Transitory (suspense)
  // account from a Jurnal Excel Import — lets this row offer reclassify
  // right here instead of sending the user to the separate Reklasifikasi
  // page (see ReklasifikasiInline below).
  contraLineId: string | null;
  needsReklasifikasi: boolean;
};

export type AccountOption = { id: string; code: string; name: string };

function VoidButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function voidEntry() {
    const reason = window.prompt("Alasan pembatalan jurnal ini:");
    if (!reason) return;
    startTransition(async () => {
      const res = await fetch(`/api/finance/journal/${id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) router.refresh();
      else window.alert("Gagal membatalkan jurnal.");
    });
  }

  return (
    <button
      onClick={voidEntry}
      disabled={pending}
      title="Batalkan jurnal"
      className="flex h-7 w-7 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

// Reclassifies one row right here in Riwayat Jurnal — same endpoint as
// the dedicated Reklasifikasi page, offered inline so a transaction that
// just landed in a Buku Kas can be journaled immediately without
// navigating away. Added per explicit request: "diberikan akses untuk
// menjurnal setelah transaksi terupload ke buku kas" (2026-10-13).
function ReklasifikasiInline({ lineId, accounts }: { lineId: string; accounts: AccountOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!accountId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/journal/reclassify/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (res.ok) {
        router.refresh();
      } else {
        setError(typeof data.error === "string" ? data.error : "Gagal menyimpan.");
      }
    } catch {
      setError("Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-semibold text-amber-700 hover:text-amber-800">
        Jurnal akun ini →
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <select
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px]"
      >
        <option value="">— pilih akun —</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            [{a.code}] {a.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={!accountId || saving}
        className="rounded-md border border-accent-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-accent-700 hover:bg-accent-50 disabled:opacity-50"
      >
        {saving ? "..." : "Simpan"}
      </button>
      {error && <span className="text-[10px] font-semibold text-rose-600">{error}</span>}
    </span>
  );
}

export function JournalEntryList({ entries, accounts = [] }: { entries: JournalEntryRow[]; accounts?: AccountOption[] }) {
  return (
    <Table wrapperClassName="max-h-[70vh] overflow-y-auto">
      <Thead className="sticky top-0 z-20 bg-slate-50">
        <tr>
          <Th>No. Voucher</Th>
          <Th>Tanggal</Th>
          <Th>Buku Kas</Th>
          <Th>Jenis</Th>
          <Th>Keterangan</Th>
          <Th className="text-right">Nominal</Th>
          <Th>Status</Th>
          <Th></Th>
        </tr>
      </Thead>
      <tbody>
        {entries.map((e) => (
          <Tr key={e.id} className={e.status === "VOID" ? "opacity-50" : ""}>
            <Td className="font-mono text-xs text-slate-500">{e.entryNumber}</Td>
            <Td>{new Date(e.date).toLocaleDateString("id-ID")}</Td>
            <Td>{e.cashBook ? (CASH_BOOK_LABELS[e.cashBook as keyof typeof CASH_BOOK_LABELS] ?? e.cashBook) : "— (non-kas)"}</Td>
            <Td>{JOURNAL_ENTRY_TYPE_LABELS[e.entryType as keyof typeof JOURNAL_ENTRY_TYPE_LABELS] ?? e.entryType}</Td>
            <Td>
              <p className="font-medium text-slate-800">{e.description}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                <span>
                  {e.cashLine} ↔ {e.contraLine}
                  {e.outletName ? ` · ${e.outletName}` : ""}
                </span>
                {e.needsReklasifikasi && e.contraLineId && <ReklasifikasiInline lineId={e.contraLineId} accounts={accounts} />}
              </p>
            </Td>
            <Td className="text-right font-semibold">{currency.format(e.amount)}</Td>
            <Td>
              <Badge tone={e.status === "VOID" ? "danger" : "success"}>{e.status === "VOID" ? "Dibatalkan" : "Posted"}</Badge>
            </Td>
            <Td>{e.status !== "VOID" && <VoidButton id={e.id} />}</Td>
          </Tr>
        ))}
        {entries.length === 0 && <EmptyRow colSpan={8}>Belum ada jurnal pada periode ini.</EmptyRow>}
      </tbody>
    </Table>
  );
}
