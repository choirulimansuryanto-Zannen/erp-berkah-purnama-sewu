"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TIERS = ["ALL", "BRONZE", "SILVER", "GOLD"] as const;

export function CreateCampaignForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetTier, setTargetTier] = useState<(typeof TIERS)[number]>("ALL");
  const [bonusMultiplier, setBonusMultiplier] = useState("1");
  const [discountPercent, setDiscountPercent] = useState("");
  const [budgetCap, setBudgetCap] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          startDate,
          endDate,
          targetTier: targetTier === "ALL" ? undefined : targetTier,
          bonusMultiplier: Number(bonusMultiplier),
          discountPercent: discountPercent ? Number(discountPercent) : undefined,
          budgetCap: budgetCap ? Number(budgetCap) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Campaign dibuat sebagai DRAFT.");
        setName("");
        setDescription("");
        setStartDate("");
        setEndDate("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buat Campaign Baru</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nama Campaign</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder='mis. "Spend Rp 100k, earn 2x points"' />
          </div>
          <div className="sm:col-span-2">
            <Label>Deskripsi (opsional)</Label>
            <Textarea className="mt-1" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Tanggal Mulai</Label>
            <Input className="mt-1" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Tanggal Selesai</Label>
            <Input className="mt-1" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>Target Tier</Label>
            <Select className="mt-1" value={targetTier} onChange={(e) => setTargetTier(e.target.value as (typeof TIERS)[number])}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t === "ALL" ? "Semua Tier" : t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Bonus Poin (kelipatan)</Label>
            <Input className="mt-1" type="number" step="0.1" value={bonusMultiplier} onChange={(e) => setBonusMultiplier(e.target.value)} />
          </div>
          <div>
            <Label>Diskon (%, opsional)</Label>
            <Input className="mt-1" type="number" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
          </div>
          <div>
            <Label>Budget Cap (Rp, opsional)</Label>
            <Input className="mt-1" type="number" value={budgetCap} onChange={(e) => setBudgetCap(e.target.value)} />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !name || !startDate || !endDate} className="mt-4">
          {pending ? "Menyimpan..." : "Buat Campaign"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
