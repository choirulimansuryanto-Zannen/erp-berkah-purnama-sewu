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
  cashBook: string;
  entryType: string;
  description: string;
  reference: string | null;
  status: string;
  outletName: string | null;
  amount: number;
  cashLine: string;
  contraLine: string;
};

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

export function JournalEntryList({ entries }: { entries: JournalEntryRow[] }) {
  return (
    <Table>
      <Thead>
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
            <Td>{CASH_BOOK_LABELS[e.cashBook as keyof typeof CASH_BOOK_LABELS] ?? e.cashBook}</Td>
            <Td>{JOURNAL_ENTRY_TYPE_LABELS[e.entryType as keyof typeof JOURNAL_ENTRY_TYPE_LABELS] ?? e.entryType}</Td>
            <Td>
              <p className="font-medium text-slate-800">{e.description}</p>
              <p className="text-xs text-slate-400">
                {e.cashLine} ↔ {e.contraLine}
                {e.outletName ? ` · ${e.outletName}` : ""}
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
