"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function StockMinLevelRow({
  productId,
  productName,
  sku,
  qtyOnHand,
  minLevel,
}: {
  productId: string;
  productName: string;
  sku: string;
  qtyOnHand: number;
  minLevel: number;
}) {
  const [value, setValue] = useState(String(minLevel));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const belowMin = minLevel > 0 && qtyOnHand < minLevel;

  function save() {
    startTransition(async () => {
      await fetch(`/api/warehouse/stock/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minLevel: Number(value) }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Tr>
      <Td className="font-medium text-slate-900">{productName}</Td>
      <Td className="text-slate-400">{sku}</Td>
      <Td>{qtyOnHand.toLocaleString("id-ID")}</Td>
      <Td>
        <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="w-24" />
      </Td>
      <Td>
        {belowMin ? (
          <Badge tone="danger">Reorder</Badge>
        ) : (
          <Badge tone="success">Aman</Badge>
        )}
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
