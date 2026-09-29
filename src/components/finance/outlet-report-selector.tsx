"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Outlet is part of the URL path (/finance/outlet/[outletId]), not a query
// param, so this can't be a plain <form> — changing it needs a client-side
// navigation to a different path (with year/month carried over), which a
// bare HTML form submit can't express.
export function OutletReportSelector({
  outlets,
  outletId,
  year,
  month,
  years,
}: {
  outlets: { id: string; name: string }[];
  outletId: string;
  year: number;
  month: number;
  years: number[];
}) {
  const router = useRouter();
  const [selectedOutlet, setSelectedOutlet] = useState(outletId);
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedYear, setSelectedYear] = useState(year);

  function go() {
    router.push(`/finance/outlet/${selectedOutlet}?year=${selectedYear}&month=${selectedMonth}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 p-5">
      <div>
        <Label className="text-[11px]">Outlet</Label>
        <Select className="mt-1" value={selectedOutlet} onChange={(e) => setSelectedOutlet(e.target.value)}>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label className="text-[11px]">Bulan</Label>
        <Select className="mt-1" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label className="text-[11px]">Tahun</Label>
        <Select className="mt-1" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      <Button variant="secondary" onClick={go}>
        Tampilkan
      </Button>
    </div>
  );
}
