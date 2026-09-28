"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUSES = ["ACTIVE", "INACTIVE"] as const;

export function VoucherRow({
  id,
  code,
  rewardProductName,
  rewardQty,
  redemptionCount,
  maxRedemptions,
  validFrom,
  validUntil,
  status,
}: {
  id: string;
  code: string;
  rewardProductName: string;
  rewardQty: number;
  redemptionCount: number;
  maxRedemptions: number | null;
  validFrom: string | null;
  validUntil: string | null;
  status: string;
}) {
  const [statusValue, setStatusValue] = useState(status);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await fetch(`/api/admin/vouchers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusValue }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  const validityLabel =
    validFrom || validUntil
      ? `${validFrom ? new Date(validFrom).toLocaleDateString("id-ID") : "-"} s/d ${validUntil ? new Date(validUntil).toLocaleDateString("id-ID") : "-"}`
      : "Tanpa batas waktu";

  return (
    <Tr>
      <Td className="font-mono text-xs font-semibold text-slate-900">{code}</Td>
      <Td>
        {rewardProductName} <span className="text-slate-400">×{rewardQty}</span>
      </Td>
      <Td>
        {redemptionCount} / {maxRedemptions ?? "∞"}
      </Td>
      <Td className="text-xs text-slate-500">{validityLabel}</Td>
      <Td>
        <Badge tone={statusValue === "ACTIVE" ? "success" : "neutral"}>{statusValue}</Badge>
      </Td>
      <Td>
        <div className="flex items-center gap-2">
          <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="w-28">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Button onClick={save} disabled={pending} variant="outline" size="sm">
            {saved ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" /> OK
              </>
            ) : (
              "Simpan"
            )}
          </Button>
        </div>
      </Td>
    </Tr>
  );
}
