"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUSES = ["ACTIVE", "SEASONAL", "INACTIVE"] as const;

export function ToppingRow({
  id,
  name,
  price,
  status,
}: {
  id: string;
  name: string;
  price: number;
  status: string;
}) {
  const [priceValue, setPriceValue] = useState(String(price));
  const [statusValue, setStatusValue] = useState(status);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await fetch(`/api/admin/toppings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: Number(priceValue), status: statusValue }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Tr>
      <Td className="font-medium text-slate-900">{name}</Td>
      <Td>
        <Input type="number" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} className="w-28" />
      </Td>
      <Td>
        <Select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="w-32">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Td>
      <Td>
        <Button onClick={save} disabled={pending} variant="outline" size="sm">
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" /> Tersimpan
            </>
          ) : (
            "Simpan"
          )}
        </Button>
      </Td>
    </Tr>
  );
}
