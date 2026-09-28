"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CASH_BOOK_LABELS } from "@/lib/accounting-labels";

export function CoaRow({
  id,
  code,
  name,
  normalBalance,
  status,
  parentLabel,
  cashBook,
  depth,
}: {
  id: string;
  code: string;
  name: string;
  normalBalance: string;
  status: string;
  parentLabel: string | null;
  cashBook: string | null;
  depth: number;
}) {
  const router = useRouter();
  const [nameValue, setNameValue] = useState(name);
  const [statusValue, setStatusValue] = useState(status);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/chart-of-accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue, status: statusValue }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm(`Hapus akun "${code} — ${name}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/chart-of-accounts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) router.refresh();
      else setError(typeof data.error === "string" ? data.error : "Gagal menghapus.");
    });
  }

  return (
    <Tr>
      <Td className="font-mono text-xs text-slate-500" style={{ paddingLeft: `${12 + depth * 20}px` }}>
        {code}
      </Td>
      <Td>
        <Input value={nameValue} onChange={(e) => setNameValue(e.target.value)} className="w-56" />
        {parentLabel && <p className="mt-0.5 text-[11px] text-slate-400">di bawah {parentLabel}</p>}
      </Td>
      <Td>{normalBalance === "DEBIT" ? "Debit" : "Kredit"}</Td>
      <Td>{cashBook ? <Badge tone="info">{CASH_BOOK_LABELS[cashBook as keyof typeof CASH_BOOK_LABELS]}</Badge> : "-"}</Td>
      <Td>
        <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="w-28">
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </Select>
      </Td>
      <Td>
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={pending} variant="outline" size="sm">
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" /> Tersimpan
              </>
            ) : (
              "Simpan"
            )}
          </Button>
          {!cashBook && (
            <button
              onClick={remove}
              disabled={pending}
              title="Hapus akun"
              className="flex h-8 w-8 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </Td>
    </Tr>
  );
}
