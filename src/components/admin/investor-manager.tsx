"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const percent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });

export type InvestorRow = { id: string; name: string; ownershipPct: number; status: string; note: string | null };

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function remove() {
    if (!window.confirm("Hapus/nonaktifkan investor ini?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/investors/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else window.alert("Gagal menghapus investor.");
    });
  }
  return (
    <button onClick={remove} disabled={pending} title="Hapus" className="flex h-7 w-7 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

export function InvestorManager({ investors, sharingProfitRate }: { investors: InvestorRow[]; sharingProfitRate: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ownershipPct, setOwnershipPct] = useState("");
  const [note, setNote] = useState("");
  const [rate, setRate] = useState(String(sharingProfitRate));
  const [pending, startTransition] = useTransition();
  const [ratePending, startRateTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const totalOwnership = investors.filter((i) => i.status === "ACTIVE").reduce((s, i) => s + i.ownershipPct, 0);
  const ownershipOk = Math.abs(totalOwnership - 100) < 0.01;

  function addInvestor() {
    startTransition(async () => {
      const res = await fetch("/api/admin/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ownershipPct: Number(ownershipPct), note: note || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setName("");
        setOwnershipPct("");
        setNote("");
        router.refresh();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  function saveRate() {
    startRateTransition(async () => {
      const res = await fetch("/api/admin/sharing-profit-rule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate: Number(rate) }),
      });
      if (res.ok) router.refresh();
      else window.alert("Gagal menyimpan rate sharing profit.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rate Pool Sharing Profit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-slate-500">
            Persentase dari Laba Bersih perusahaan tiap bulan yang disisihkan sebagai pool investor, sebelum dibagi per investor
            sesuai % kepemilikan masing-masing.
          </p>
          <div className="flex items-end gap-3">
            <div>
              <Label>Rate Pool (% dari Laba Bersih)</Label>
              <Input className="mt-1 w-40" type="number" step="0.001" min="0" max="100" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <Button onClick={saveRate} disabled={ratePending || Number(rate) === sharingProfitRate}>
              {ratePending ? "Menyimpan..." : "Simpan Rate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tambah Investor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Nama Investor</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: PT Modal Bersama" />
            </div>
            <div>
              <Label>Kepemilikan (%)</Label>
              <Input className="mt-1" type="number" step="0.001" min="0" max="100" value={ownershipPct} onChange={(e) => setOwnershipPct(e.target.value)} />
            </div>
            <div>
              <Label>Catatan (Opsional)</Label>
              <Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <Button className="mt-3" onClick={addInvestor} disabled={pending || !name || !ownershipPct}>
            {pending ? "Menyimpan..." : "Tambah Investor"}
          </Button>
          {message && <p className="mt-2 text-sm text-rose-600">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Investor</CardTitle>
          <Badge tone={ownershipOk ? "success" : "danger"}>
            Total kepemilikan aktif: {percent.format(totalOwnership)}% {ownershipOk ? "✓" : "⚠ harus 100%"}
          </Badge>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th className="text-right">Kepemilikan</Th>
              <Th>Status</Th>
              <Th>Catatan</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {investors.map((i) => (
              <Tr key={i.id} className={i.status === "INACTIVE" ? "opacity-50" : ""}>
                <Td className="font-medium text-slate-900">{i.name}</Td>
                <Td className="text-right">{percent.format(i.ownershipPct)}%</Td>
                <Td>
                  <Badge tone={i.status === "ACTIVE" ? "success" : "neutral"}>{i.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</Badge>
                </Td>
                <Td className="text-xs text-slate-400">{i.note ?? ""}</Td>
                <Td>
                  <DeleteButton id={i.id} />
                </Td>
              </Tr>
            ))}
            {investors.length === 0 && <EmptyRow colSpan={5}>Belum ada investor.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
