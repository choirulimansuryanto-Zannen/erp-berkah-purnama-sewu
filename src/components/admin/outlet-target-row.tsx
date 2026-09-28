"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function OutletTargetRow({
  id,
  name,
  dailyTarget,
  maxPramuniagaPerShift,
}: {
  id: string;
  name: string;
  dailyTarget: number;
  maxPramuniagaPerShift: number;
}) {
  const [value, setValue] = useState(String(dailyTarget));
  const [maxShiftValue, setMaxShiftValue] = useState(String(maxPramuniagaPerShift));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await fetch(`/api/admin/outlets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyTarget: Number(value), maxPramuniagaPerShift: Number(maxShiftValue) }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Tr>
      <Td className="font-medium text-slate-900">{name}</Td>
      <Td>
        <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="w-36" />
      </Td>
      <Td>
        <Input type="number" min={1} value={maxShiftValue} onChange={(e) => setMaxShiftValue(e.target.value)} className="w-20" />
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
