"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const CATEGORY_LABELS: Record<string, string> = {
  BAHAN_BAKU: "Bahan Baku",
  BAHAN_SETENGAH_JADI: "Bahan Setengah Jadi",
  BARANG_JADI: "Barang Jadi",
  BAHAN_PENDUKUNG: "Bahan Pendukung",
  PROYEK_DALAM_PENYELESAIAN: "Proyek Dalam Penyelesaian",
};

export type InventoryClosingRow = {
  id: string;
  year: number;
  month: number;
  category: string;
  amount: number;
  note: string | null;
  recordedBy: { name: string } | null;
};

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("Hapus data Persediaan Akhir ini?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/finance/inventory-closing/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else window.alert("Gagal menghapus data.");
    });
  }

  return (
    <button
      onClick={remove}
      disabled={pending}
      title="Hapus"
      className="flex h-7 w-7 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

export function InventoryClosingList({ rows }: { rows: InventoryClosingRow[] }) {
  const sorted = [...rows].sort((a, b) => (a.year !== b.year ? b.year - a.year : a.month !== b.month ? b.month - a.month : a.category.localeCompare(b.category)));
  return (
    <Table>
      <Thead>
        <tr>
          <Th>Bulan</Th>
          <Th>Kategori</Th>
          <Th className="text-right">Persediaan Akhir</Th>
          <Th>Dicatat Oleh</Th>
          <Th>Catatan</Th>
          <Th></Th>
        </tr>
      </Thead>
      <tbody>
        {sorted.map((r) => (
          <Tr key={r.id}>
            <Td>
              {MONTH_NAMES[r.month - 1]} {r.year}
            </Td>
            <Td>{CATEGORY_LABELS[r.category] ?? r.category}</Td>
            <Td className="text-right font-semibold">{currency.format(r.amount)}</Td>
            <Td className="text-xs text-slate-500">{r.recordedBy?.name ?? "-"}</Td>
            <Td className="max-w-[220px] truncate text-xs text-slate-400">{r.note ?? ""}</Td>
            <Td>
              <DeleteButton id={r.id} />
            </Td>
          </Tr>
        ))}
        {sorted.length === 0 && <EmptyRow colSpan={6}>Belum ada data Persediaan Akhir tercatat.</EmptyRow>}
      </tbody>
    </Table>
  );
}
