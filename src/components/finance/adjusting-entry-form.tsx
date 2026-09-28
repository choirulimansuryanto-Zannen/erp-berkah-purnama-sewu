"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Account = { id: string; code: string; name: string; type: string; cashBook: string | null };

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Depresiasi, akrual, amortisasi dibayar-di-muka, koreksi — any two-account
// swap that does NOT touch cash. Cash-book accounts are excluded from both
// dropdowns: that's exactly what separates a Jurnal Penyesuaian from a
// voucher on the Jurnal (6 Buku Kas) page.
export function AdjustingEntryForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const nonCashAccounts = useMemo(() => accounts.filter((a) => !a.cashBook), [accounts]);

  function submit() {
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/adjusting-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          description,
          reference: reference || undefined,
          debitAccountId,
          creditAccountId,
          amount: Number(amount),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Tersimpan sebagai ${data.entry_number}.`);
        setSuccess(true);
        setDescription("");
        setReference("");
        setDebitAccountId("");
        setCreditAccountId("");
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
        <CardTitle>Input Jurnal Penyesuaian</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Tanggal</Label>
            <Input className="mt-1" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Nominal (Rp)</Label>
            <Input className="mt-1" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>No. Referensi (Opsional)</Label>
            <Input className="mt-1" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No. Memo / Bukti" />
          </div>

          <div>
            <Label>Akun Debit</Label>
            <Select className="mt-1" value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)}>
              <option value="">Pilih akun...</option>
              {nonCashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Akun Kredit</Label>
            <Select className="mt-1" value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)}>
              <option value="">Pilih akun...</option>
              {nonCashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-3">
            <Label>Keterangan</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Penyusutan Kendaraan Operasional bulan September 2026"
            />
          </div>
        </div>

        <Button
          onClick={submit}
          disabled={pending || !description || !debitAccountId || !creditAccountId || !amount || Number(amount) <= 0}
          className="mt-4"
        >
          {pending ? "Menyimpan..." : "Posting Jurnal Penyesuaian"}
        </Button>
        {message && <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
      </CardContent>
    </Card>
  );
}
