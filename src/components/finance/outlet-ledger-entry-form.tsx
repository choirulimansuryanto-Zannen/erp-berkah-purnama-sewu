"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Label, Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function OutletLedgerEntryDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function remove() {
    if (!window.confirm("Hapus baris Jurnal Sheet ini?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/finance/outlet-ledger/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else window.alert("Gagal menghapus data.");
    });
  }
  return (
    <button onClick={remove} disabled={pending} title="Hapus" className="flex h-6 w-6 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">
      <X className="h-3 w-3" />
    </button>
  );
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type LedgerAccountOption = { id: string; number: number; label: string; defaultSide: "D" | "C" };

// Jurnal Sheet ledger input — a direct digitization of the business's own
// daily bookkeeping habit: type the No. Akun (a plain number field, no
// dropdown to scroll through), and Nama Akun looks itself up and displays
// automatically as you type (e.g. typing "1" shows "Penjualan Produk
// (Outlet)") — D/C pre-fills from that account's default too, still
// overridable. Keterangan and Nilai are typed as usual; Accum./Total-Day
// are computed server-side from every row.
export function OutletLedgerEntryForm({ outletId, accounts }: { outletId: string; accounts: LedgerAccountOption[] }) {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [numberInput, setNumberInput] = useState(accounts[0] ? String(accounts[0].number) : "");
  const [description, setDescription] = useState("");
  const [side, setSide] = useState<"D" | "C">(accounts[0]?.defaultSide ?? "D");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const matchedAccount = accounts.find((a) => String(a.number) === numberInput.trim());

  function onNumberChange(value: string) {
    setNumberInput(value);
    const acc = accounts.find((a) => String(a.number) === value.trim());
    if (acc) setSide(acc.defaultSide);
  }

  function submit() {
    if (!matchedAccount) return;
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/finance/outlet-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId,
          date,
          accountId: matchedAccount.id,
          description,
          side,
          amount: Number(amount) || 0,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Baris Jurnal Sheet tersimpan.");
        setSuccess(true);
        setDescription("");
        setAmount("");
        setNote("");
        router.refresh();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div>
          <Label className="text-[11px]">Tanggal</Label>
          <Input className="mt-1" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px]">No. Akun</Label>
          <Input className="mt-1" type="number" value={numberInput} onChange={(e) => onNumberChange(e.target.value)} placeholder="Contoh: 1" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[11px]">Nama Akun</Label>
          <Input
            className="mt-1 bg-slate-50 text-slate-600"
            value={matchedAccount ? matchedAccount.label : numberInput ? "— No. Akun tidak ditemukan —" : ""}
            readOnly
            tabIndex={-1}
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-[11px]">Keterangan</Label>
          <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Faktur AB" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label className="text-[11px]">D/C</Label>
          <Select className="mt-1" value={side} onChange={(e) => setSide(e.target.value as "D" | "C")}>
            <option value="D">D</option>
            <option value="C">C</option>
          </Select>
        </div>
        <div>
          <Label className="text-[11px]">Nilai (Rp.)</Label>
          <Input className="mt-1" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div className="col-span-2">
          <Label className="text-[11px]">Catatan (Opsional)</Label>
          <Textarea className="mt-1" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <Button onClick={submit} disabled={pending || !description || !amount || !matchedAccount}>
        {pending ? "Menyimpan..." : "Tambah Baris"}
      </Button>
      {message && <p className={`text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
    </div>
  );
}
