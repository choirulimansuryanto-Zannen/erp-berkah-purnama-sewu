"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateIncentiveBracketForm() {
  const [label, setLabel] = useState("");
  const [rangeMin, setRangeMin] = useState("");
  const [rangeMax, setRangeMax] = useState("");
  const [rateSinglePic, setRateSinglePic] = useState("");
  const [rateMultiPic, setRateMultiPic] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/admin/incentive-brackets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          rangeMin: Number(rangeMin) || 0,
          rangeMax: rangeMax === "" ? undefined : Number(rangeMax),
          rateSinglePic: Number(rateSinglePic) || 0,
          rateMultiPic: Number(rateMultiPic) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Bracket dibuat: ${label}`);
        setLabel("");
        setRangeMin("");
        setRangeMax("");
        setRateSinglePic("");
        setRateMultiPic("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Bracket Omset</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-5">
          <div>
            <Label>Label</Label>
            <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Contoh: 605.000 - 770.000" />
          </div>
          <div>
            <Label>Omset Min (Rp)</Label>
            <Input className="mt-1" type="number" min="0" value={rangeMin} onChange={(e) => setRangeMin(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Omset Max (Rp, kosongkan jika tak terbatas)</Label>
            <Input className="mt-1" type="number" min="0" value={rangeMax} onChange={(e) => setRangeMax(e.target.value)} placeholder="(tak terbatas)" />
          </div>
          <div>
            <Label>Rate 1 PIC (%)</Label>
            <Input className="mt-1" type="number" min="0" step="0.001" value={rateSinglePic} onChange={(e) => setRateSinglePic(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Rate +1 PIC (%)</Label>
            <Input className="mt-1" type="number" min="0" step="0.001" value={rateMultiPic} onChange={(e) => setRateMultiPic(e.target.value)} placeholder="0" />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !label} className="mt-4">
          {pending ? "Menyimpan..." : "Tambah Bracket"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
