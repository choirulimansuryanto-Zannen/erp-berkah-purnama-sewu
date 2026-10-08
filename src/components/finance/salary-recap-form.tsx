"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DEPARTMENTS = [
  { value: "BOD", label: "BOD" },
  { value: "PRODUCTION", label: "Production" },
  { value: "OPERATION", label: "Operation" },
  { value: "SALES_OFFICE", label: "Sales Office" },
  { value: "SALES_OUTLET", label: "Sales Outlet" },
  { value: "MARKETING", label: "Marketing" },
  { value: "FA", label: "FA" },
  { value: "HR_GA", label: "HR & GA" },
];
const FIELDS = [
  { key: "totalTerimaNet", label: "Total Terima (NET)" },
  { key: "koperasi", label: "Koperasi" },
  { key: "iuranBpjs", label: "Iuran BPJS" },
  { key: "kasbon", label: "Kasbon" },
  { key: "pph21", label: "PPh21" },
  { key: "adjLain", label: "ADJ Lain" },
  { key: "sanksi", label: "Sanksi" },
  { key: "insentifTjOutlet", label: "Insentive & Tj.Outlet" },
] as const;

function currentYear(): number {
  return new Date().getFullYear();
}
function currentMonth(): number {
  return new Date().getMonth() + 1;
}

export function SalaryRecapForm() {
  const router = useRouter();
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(currentMonth());
  const [department, setDepartment] = useState(DEPARTMENTS[0].value);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const years = Array.from({ length: 5 }, (_, i) => currentYear() - 2 + i);

  function submit() {
    setSuccess(false);
    startTransition(async () => {
      const body = {
        year,
        month,
        department,
        ...Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key] ?? 0)])),
      };
      const res = await fetch("/api/finance/salary-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Rekap Salary ${department} — ${MONTH_NAMES[month - 1]} ${year} tersimpan.`);
        setSuccess(true);
        router.refresh();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Input / Update Rekap Salary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <Label>Bulan</Label>
            <Select className="mt-1" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Tahun</Label>
            <Select className="mt-1" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Departemen</Label>
            <Select className="mt-1" value={department} onChange={(e) => setDepartment(e.target.value)}>
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input
                className="mt-1"
                type="number"
                min="0"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder="0"
              />
            </div>
          ))}
        </div>

        <Button onClick={submit} disabled={pending} className="mt-4">
          {pending ? "Menyimpan..." : "Simpan Rekap Salary"}
        </Button>
        {message && <p className={`mt-2 text-sm ${success ? "text-emerald-700" : "text-rose-600"}`}>{message}</p>}
      </CardContent>
    </Card>
  );
}
