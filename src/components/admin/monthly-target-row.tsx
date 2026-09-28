"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Tr, Td } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MONTH_LABELS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function MonthlyTargetRow({
  outletId,
  year,
  month,
  monthlyTarget,
  dailyTarget,
  insentifMonthlyTarget,
  insentifDailyTarget,
  fullshiftDailyTarget,
  isCurrentMonth,
}: {
  outletId: string;
  year: number;
  month: number;
  monthlyTarget: number;
  dailyTarget: number;
  insentifMonthlyTarget: number;
  insentifDailyTarget: number;
  fullshiftDailyTarget: number;
  isCurrentMonth: boolean;
}) {
  const [monthlyValue, setMonthlyValue] = useState(String(monthlyTarget));
  const [dailyValue, setDailyValue] = useState(String(dailyTarget));
  const [insentifMonthlyValue, setInsentifMonthlyValue] = useState(String(insentifMonthlyTarget));
  const [insentifDailyValue, setInsentifDailyValue] = useState(String(insentifDailyTarget));
  const [fullshiftDailyValue, setFullshiftDailyValue] = useState(String(fullshiftDailyTarget));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await fetch(`/api/admin/outlets/${outletId}/targets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          monthlyTarget: Number(monthlyValue),
          dailyTarget: Number(dailyValue),
          insentifMonthlyTarget: Number(insentifMonthlyValue),
          insentifDailyTarget: Number(insentifDailyValue),
          fullshiftDailyTarget: Number(fullshiftDailyValue),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Tr className={isCurrentMonth ? "bg-accent-50/50" : undefined}>
      <Td className="font-medium text-slate-900">
        {MONTH_LABELS[month - 1]}
        {isCurrentMonth && <span className="ml-1.5 text-[11px] font-normal text-accent-600">(bulan berjalan)</span>}
      </Td>
      <Td>
        <Input type="number" value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)} className="w-32" />
      </Td>
      <Td>
        <Input type="number" value={dailyValue} onChange={(e) => setDailyValue(e.target.value)} className="w-28" />
      </Td>
      <Td>
        <Input type="number" value={insentifMonthlyValue} onChange={(e) => setInsentifMonthlyValue(e.target.value)} className="w-32" />
      </Td>
      <Td>
        <Input type="number" value={insentifDailyValue} onChange={(e) => setInsentifDailyValue(e.target.value)} className="w-28" />
      </Td>
      <Td>
        <Input type="number" value={fullshiftDailyValue} onChange={(e) => setFullshiftDailyValue(e.target.value)} className="w-28" />
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
