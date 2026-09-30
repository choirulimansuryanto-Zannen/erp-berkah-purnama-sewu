"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CASH_BOOK_LABELS, JOURNAL_ENTRY_TYPE_LABELS, CASH_BOOK_TRANSFER_DESTINATIONS } from "@/lib/accounting-labels";

type Account = { id: string; code: string; name: string; type: string; cashBook: string | null };

const CASH_BOOKS = Object.keys(CASH_BOOK_LABELS) as (keyof typeof CASH_BOOK_LABELS)[];
const ENTRY_TYPES = Object.keys(JOURNAL_ENTRY_TYPE_LABELS) as (keyof typeof JOURNAL_ENTRY_TYPE_LABELS)[];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function JournalVoucherForm({
  accounts,
  outlets,
}: {
  accounts: Account[];
  outlets: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [cashBook, setCashBook] = useState<string>("KASIR");
  const [entryType, setEntryType] = useState<string>("KAS_MASUK");
  const [date, setDate] = useState(todayStr());
  const [outletId, setOutletId] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [contraAccountId, setContraAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  // Kas Masuk/Keluar: any non-cash-book account is a valid "lawan akun".
  // Transfer Antar Buku: the contra must be one of THIS book's allowed
  // destinations per the business's own fund-flow rule (e.g. Kasir only
  // ever forwards to Brankas; Petty Cash only ever receives from Brankas
  // and only ever pays into a bank) — not just "any other cash book".
  const contraOptions = useMemo(() => {
    if (entryType === "TRANSFER_ANTAR_BUKU") {
      const allowed = CASH_BOOK_TRANSFER_DESTINATIONS[cashBook as keyof typeof CASH_BOOK_TRANSFER_DESTINATIONS] ?? [];
      return accounts.filter((a) => a.cashBook && allowed.includes(a.cashBook as never));
    }
    return accounts.filter((a) => !a.cashBook);
  }, [accounts, entryType, cashBook]);

  function submit() {
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashBook,
          entryType,
          date,
          outletId: outletId || undefined,
          description,
          reference: reference || undefined,
          contraAccountId,
          amount: Number(amount),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Tersimpan sebagai ${data.entry_number}.`);
        setSuccess(true);
        setDescription("");
        setReference("");
        setContraAccountId("");
        setAmount("");
        router.refresh();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Input Jurnal (Voucher Kas)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Buku Kas {entryType === "TRANSFER_ANTAR_BUKU" && "(Asal)"}</Label>
            <Select className="mt-1" value={cashBook} onChange={(e) => setCashBook(e.target.value)}>
              {CASH_BOOKS.map((b) => (
                <option key={b} value={b}>
                  {CASH_BOOK_LABELS[b]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Jenis Transaksi</Label>
            <Select className="mt-1" value={entryType} onChange={(e) => { setEntryType(e.target.value); setContraAccountId(""); }}>
              {ENTRY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {JOURNAL_ENTRY_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Tanggal</Label>
            <Input className="mt-1" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <Label>{entryType === "TRANSFER_ANTAR_BUKU" ? "Buku Kas Tujuan" : "Lawan Akun (Akun Terkait)"}</Label>
            <Select className="mt-1" value={contraAccountId} onChange={(e) => setContraAccountId(e.target.value)}>
              <option value="">Pilih akun...</option>
              {contraOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
            {entryType === "TRANSFER_ANTAR_BUKU" && (
              <p className="mt-1 text-[11px] text-slate-400">
                {CASH_BOOK_LABELS[cashBook as keyof typeof CASH_BOOK_LABELS]} hanya boleh transfer ke:{" "}
                {(CASH_BOOK_TRANSFER_DESTINATIONS[cashBook as keyof typeof CASH_BOOK_TRANSFER_DESTINATIONS] ?? [])
                  .map((b) => CASH_BOOK_LABELS[b])
                  .join(", ")}
                .
              </p>
            )}
          </div>
          <div>
            <Label>Nominal (Rp)</Label>
            <Input className="mt-1" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>

          <div className="sm:col-span-2">
            <Label>Keterangan</Label>
            <Textarea className="mt-1" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Setoran omset outlet Panjaitan 27 Agustus" />
          </div>
          <div>
            <Label>No. Referensi (Opsional)</Label>
            <Input className="mt-1" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No. Nota / Bukti" />
          </div>

          {outlets.length > 0 && (
            <div className="sm:col-span-3">
              <Label>Outlet Terkait (Opsional — untuk FA Outlet)</Label>
              <Select className="mt-1" value={outletId} onChange={(e) => setOutletId(e.target.value)}>
                <option value="">— Tidak terkait outlet tertentu —</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <Button
          onClick={submit}
          disabled={pending || !description || !contraAccountId || !amount || Number(amount) <= 0}
          className="mt-4"
        >
          {pending ? "Menyimpan..." : "Posting Jurnal"}
        </Button>
        {message && (
          <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
