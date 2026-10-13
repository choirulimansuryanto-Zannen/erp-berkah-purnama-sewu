"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CashBookOfficerRow({ cashBook, label, officerName }: { cashBook: string; label: string; officerName: string }) {
  const [value, setValue] = useState(officerName);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await fetch(`/api/admin/cash-book-officers/${cashBook}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officerName: value }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Tr>
      <Td className="font-medium text-slate-900">{label}</Td>
      <Td>
        <Input value={value} onChange={(e) => setValue(e.target.value)} className="w-48" />
      </Td>
      <Td>
        <Button onClick={save} disabled={pending || !value.trim()} variant="outline" size="sm">
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
