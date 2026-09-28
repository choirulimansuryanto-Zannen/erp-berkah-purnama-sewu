"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, FileText, HeartPulse } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";

// The self-service form only exposes the two categories pramuniaga actually
// pick from day to day — "Libur" in the menu label covers the OFF category
// here (cuti/annual and the other LeaveType values stay admin/SPV-side, not
// removed from the schema, just not surfaced on this simplified form).
const CATEGORIES = [
  { value: "SAKIT", label: "Sakit (Sick Leave)", icon: HeartPulse },
  { value: "OFF", label: "Izin Off (Off / Permit)", icon: CalendarDays },
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  SAKIT: "Sakit",
  OFF: "Izin Off",
  ANNUAL: "Cuti Tahunan",
  PERSONAL: "Izin Pribadi",
  BEREAVEMENT: "Duka Cita",
  UNPAID: "Tanpa Gaji",
};

const dateLabelFormat = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function dayCount(dateFrom: string, dateTo: string): number {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

export type MyLeaveRequest = {
  id: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  reason: string;
  status: string;
};

export function LeaveRequestForm({ myRequests }: { myRequests: MyLeaveRequest[] }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof CATEGORIES)[number]["value"]>("OFF");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setDateFrom("");
    setDateTo("");
    setReason("");
    setMessage(null);
  }

  function submit() {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/attendance/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, dateFrom, dateTo, reason }),
      });
      const data = await res.json();
      if (res.ok) {
        reset();
        router.refresh();
      } else {
        setMessage(typeof data.error === "string" ? data.error : "Gagal mengirim permintaan.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-900">
            <FileText className="h-4 w-4 text-accent-600" />
            Formulir Pengajuan Baru (Izin Off &amp; Surat Sakit)
          </p>
          <button onClick={reset} className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Batal
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori Keperluan</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = type === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setType(c.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-6 text-sm font-semibold transition-colors",
                    active
                      ? "border-accent-500 bg-accent-50 text-accent-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  <Icon className={cn("h-6 w-6", active ? "text-accent-600" : "text-slate-400")} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Mulai</p>
            <Input className="mt-2" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Selesai</p>
            <Input className="mt-2" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alasan Detail Pengajuan</p>
          <Textarea
            className="mt-2 min-h-[110px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Sakit demam tinggi, izin off keperluan keluarga mendesak..."
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button onClick={reset} variant="ghost">
            Batal
          </Button>
          <Button onClick={submit} disabled={pending || !dateFrom || !dateTo || !reason} variant="secondary">
            {pending ? "Mengirim..." : "Kirim Pengajuan"}
          </Button>
        </div>
        {message && <p className="mt-2 text-right text-xs font-medium text-rose-600">{message}</p>}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-900">
            <ClipboardList className="h-4 w-4 text-accent-600" />
            Daftar Status Pengajuan Saya
          </p>
          <p className="text-xs font-medium text-slate-400">Total: {myRequests.length} Pengajuan</p>
        </div>
        <Table>
          <Thead>
            <tr>
              <Th>Kategori Keperluan</Th>
              <Th>Rentang Tanggal</Th>
              <Th>Jumlah Hari</Th>
              <Th>Keterangan / Alasan</Th>
              <Th>Status Verifikasi</Th>
            </tr>
          </Thead>
          <tbody>
            {myRequests.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-slate-900">{CATEGORY_LABEL[r.type] ?? r.type}</Td>
                <Td>
                  {dateLabelFormat.format(new Date(`${r.dateFrom}T00:00:00`))}
                  {r.dateFrom !== r.dateTo && ` – ${dateLabelFormat.format(new Date(`${r.dateTo}T00:00:00`))}`}
                </Td>
                <Td>{dayCount(r.dateFrom, r.dateTo)} hari</Td>
                <Td className="max-w-xs truncate" title={r.reason}>
                  {r.reason}
                </Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
              </Tr>
            ))}
            {myRequests.length === 0 && (
              <EmptyRow colSpan={5}>Belum ada pengajuan izin, sakit, ataupun cuti yang dibuat.</EmptyRow>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
