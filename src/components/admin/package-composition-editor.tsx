"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PackageOption = { id: string; name: string; category: string };
type ComponentOption = { id: string; name: string };
type CompositionEntry = { componentProductId?: string; componentToppingId?: string; qty: number };

// A single key namespaces product vs. topping ids so a product and a
// topping with the same underlying uuid (impossible, but different tables)
// can never collide in the qty-by-component-key map.
function keyFor(kind: "product" | "topping", id: string) {
  return `${kind}:${id}`;
}

export function PackageCompositionEditor({
  packages,
  candidateProducts,
  candidateToppings,
  compositionByPackageId,
}: {
  packages: PackageOption[];
  candidateProducts: ComponentOption[];
  candidateToppings: ComponentOption[];
  compositionByPackageId: Record<string, CompositionEntry[]>;
}) {
  const [selectedId, setSelectedId] = useState(packages[0]?.id ?? "");
  const [qtyByKey, setQtyByKey] = useState<Record<string, string>>(() => buildInitialQty(selectedId));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function buildInitialQty(packageId: string): Record<string, string> {
    const entries = compositionByPackageId[packageId] ?? [];
    const map: Record<string, string> = {};
    for (const e of entries) {
      if (e.componentProductId) map[keyFor("product", e.componentProductId)] = String(e.qty);
      else if (e.componentToppingId) map[keyFor("topping", e.componentToppingId)] = String(e.qty);
    }
    return map;
  }

  function selectPackage(id: string) {
    setSelectedId(id);
    setQtyByKey(buildInitialQty(id));
    setMessage(null);
  }

  function setQty(key: string, value: string) {
    setQtyByKey((prev) => ({ ...prev, [key]: value }));
  }

  const grouped = useMemo(() => {
    const map = new Map<string, PackageOption[]>();
    for (const p of packages) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [packages]);

  function save() {
    startTransition(async () => {
      const components = Object.entries(qtyByKey)
        .filter(([, v]) => Number(v) > 0)
        .map(([key, v]) => {
          const [kind, id] = key.split(":");
          return kind === "product" ? { componentProductId: id, qty: Number(v) } : { componentToppingId: id, qty: Number(v) };
        });

      const res = await fetch(`/api/admin/package-composition/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ components }),
      });
      setMessage(res.ok ? "Tersimpan." : "Gagal menyimpan.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Isi Paket</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-w-sm">
          <Label>Pilih Paket</Label>
          <Select className="mt-1" value={selectedId} onChange={(e) => selectPackage(e.target.value)}>
            {Array.from(grouped.entries()).map(([category, items]) => (
              <optgroup key={category} label={category.replace("_", " ")}>
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Produk (Qty)</p>
            <div className="mt-2 space-y-2">
              {candidateProducts.map((p) => {
                const key = keyFor("product", p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700">{p.name}</span>
                    <Input
                      type="number"
                      min={0}
                      value={qtyByKey[key] ?? ""}
                      onChange={(e) => setQty(key, e.target.value)}
                      placeholder="0"
                      className="w-20 text-center"
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Topping (Qty)</p>
            <div className="mt-2 space-y-2">
              {candidateToppings.map((t) => {
                const key = keyFor("topping", t.id);
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700">{t.name}</span>
                    <Input
                      type="number"
                      min={0}
                      value={qtyByKey[key] ?? ""}
                      onChange={(e) => setQty(key, e.target.value)}
                      placeholder="0"
                      className="w-20 text-center"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Button onClick={save} disabled={pending}>
            {pending ? "Menyimpan..." : "Simpan Isi Paket"}
          </Button>
          {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
