"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUSES = ["ACTIVE", "INACTIVE"] as const;

export function IncentiveBracketRow({
  id,
  label,
  rangeMin,
  rangeMax,
  rateSinglePic,
  rateMultiPic,
  sortOrder,
  status,
}: {
  id: string;
  label: string;
  rangeMin: number;
  rangeMax: number | null;
  rateSinglePic: number;
  rateMultiPic: number;
  sortOrder: number;
  status: string;
}) {
  const router = useRouter();
  const [labelValue, setLabelValue] = useState(label);
  const [rangeMinValue, setRangeMinValue] = useState(String(rangeMin));
  const [rangeMaxValue, setRangeMaxValue] = useState(rangeMax === null ? "" : String(rangeMax));
  const [rateSingleValue, setRateSingleValue] = useState(String(rateSinglePic));
  const [rateMultiValue, setRateMultiValue] = useState(String(rateMultiPic));
  const [sortOrderValue, setSortOrderValue] = useState(String(sortOrder));
  const [statusValue, setStatusValue] = useState(status);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/incentive-brackets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: labelValue,
          rangeMin: Number(rangeMinValue) || 0,
          rangeMax: rangeMaxValue === "" ? null : Number(rangeMaxValue),
          rateSinglePic: Number(rateSingleValue) || 0,
          rateMultiPic: Number(rateMultiValue) || 0,
          sortOrder: Number(sortOrderValue) || 0,
          status: statusValue,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm(`Hapus bracket "${label}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/incentive-brackets/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) router.refresh();
      else setError(typeof data.error === "string" ? data.error : "Gagal menghapus.");
    });
  }

  return (
    <Tr>
      <Td>
        <Input value={labelValue} onChange={(e) => setLabelValue(e.target.value)} className="w-40" />
      </Td>
      <Td>
        <Input type="number" min="0" value={rangeMinValue} onChange={(e) => setRangeMinValue(e.target.value)} className="w-28" />
      </Td>
      <Td>
        <Input type="number" min="0" value={rangeMaxValue} onChange={(e) => setRangeMaxValue(e.target.value)} className="w-28" placeholder="(tak terbatas)" />
      </Td>
      <Td>
        <Input type="number" min="0" step="0.001" value={rateSingleValue} onChange={(e) => setRateSingleValue(e.target.value)} className="w-20" />
        <span className="ml-1 text-xs text-slate-400">%</span>
      </Td>
      <Td>
        <Input type="number" min="0" step="0.001" value={rateMultiValue} onChange={(e) => setRateMultiValue(e.target.value)} className="w-20" />
        <span className="ml-1 text-xs text-slate-400">%</span>
      </Td>
      <Td>
        <Input type="number" value={sortOrderValue} onChange={(e) => setSortOrderValue(e.target.value)} className="w-16" />
      </Td>
      <Td>
        <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="w-28">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
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
          <button
            onClick={remove}
            disabled={pending}
            title="Hapus bracket"
            className="flex h-8 w-8 items-center justify-center rounded-md text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </Td>
    </Tr>
  );
}
