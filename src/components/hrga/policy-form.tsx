"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Policy = {
  checkpointStartHour: number;
  checkpointEndHour: number;
  checkpointIntervalMinutes: number;
  gracePeriodMinutes: number;
  annualLeaveDays: number;
  sickLeaveDays: number;
  personalLeaveDays: number;
};

export function PolicyForm({ initial }: { initial: Policy }) {
  const [policy, setPolicy] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function field(key: keyof Policy, value: string) {
    setPolicy((p) => ({ ...p, [key]: Number(value) }));
  }

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/hrga/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const data = await res.json();
      setMessage(res.ok ? "Kebijakan tersimpan." : (typeof data.error === "string" ? data.error : "Gagal menyimpan."));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Policy</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-slate-500">
          Perubahan di sini langsung memengaruhi jadwal checkpoint pramuniaga dan klasifikasi keterlambatan check-in.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <Label>Jam Mulai Checkpoint</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={23}
              value={policy.checkpointStartHour}
              onChange={(e) => field("checkpointStartHour", e.target.value)}
            />
          </div>
          <div>
            <Label>Jam Selesai Checkpoint</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={23}
              value={policy.checkpointEndHour}
              onChange={(e) => field("checkpointEndHour", e.target.value)}
            />
          </div>
          <div>
            <Label>Interval Checkpoint (menit)</Label>
            <Input
              className="mt-1"
              type="number"
              min={5}
              value={policy.checkpointIntervalMinutes}
              onChange={(e) => field("checkpointIntervalMinutes", e.target.value)}
            />
          </div>
          <div>
            <Label>Grace Period (menit)</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={policy.gracePeriodMinutes}
              onChange={(e) => field("gracePeriodMinutes", e.target.value)}
            />
          </div>
          <div>
            <Label>Cuti Tahunan (hari)</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={policy.annualLeaveDays}
              onChange={(e) => field("annualLeaveDays", e.target.value)}
            />
          </div>
          <div>
            <Label>Cuti Sakit (hari)</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={policy.sickLeaveDays}
              onChange={(e) => field("sickLeaveDays", e.target.value)}
            />
          </div>
          <div>
            <Label>Cuti Pribadi (hari)</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={policy.personalLeaveDays}
              onChange={(e) => field("personalLeaveDays", e.target.value)}
            />
          </div>
        </div>
        <Button onClick={submit} disabled={pending} className="mt-4">
          {pending ? "Menyimpan..." : "Simpan Kebijakan"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
