"use client";

import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

export function VendorRow({ id, name, status }: { id: string; name: string; status: string }) {
  const [nameValue, setNameValue] = useState(name);
  const [statusValue, setStatusValue] = useState(status);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await fetch(`/api/admin/vendors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue, status: statusValue }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function remove() {
    if (!confirm(`Nonaktifkan vendor "${name}"?`)) return;
    startTransition(async () => {
      await fetch(`/api/admin/vendors/${id}`, { method: "DELETE" });
      window.location.reload();
    });
  }

  return (
    <Tr>
      <Td>
        <Input value={nameValue} onChange={(e) => setNameValue(e.target.value)} className="w-56" />
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
          <Button onClick={remove} disabled={pending} variant="ghost" size="sm">
            <Trash2 className="h-3.5 w-3.5 text-rose-600" />
          </Button>
        </div>
      </Td>
    </Tr>
  );
}
