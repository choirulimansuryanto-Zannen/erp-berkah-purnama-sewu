"use client";

import { useState } from "react";
import { ChevronRight, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { HistoricalReportDetail, type ReportDetail } from "@/components/reports/historical-report-detail";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export type PendingReport = {
  id: string;
  outletName: string;
  pramuniagaName: string;
  dateLabel: string;
  variance: number;
  varianceStatus: string;
};

// SPV inspects the full report (same breakdown the pramuniaga sees on their
// own Riwayat Setoran) before deciding — not just the one-line summary this
// section used to show, since "apakah benar" can't really be judged from a
// variance number alone.
function ReportRow({ report }: { report: PendingReport }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ReportDetail | "loading" | "error" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [pending, setPending] = useState(false);

  function toggleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    setRejecting(false);
    if (!detail) {
      setDetail("loading");
      fetch(`/api/reports/${report.id}/detail`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: ReportDetail) => setDetail(data))
        .catch(() => setDetail("error"));
    }
  }

  function decide(status: "APPROVED" | "REJECTED", notes?: string) {
    setPending(true);
    fetch(`/api/reports/${report.id}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    }).then(() => window.location.reload());
  }

  return (
    <li>
      <button
        onClick={toggleExpand}
        className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-sm hover:bg-slate-50/60"
      >
        <span className="min-w-0 flex-1 text-slate-700">
          <span className="font-medium text-slate-900">{report.outletName}</span> · {report.pramuniagaName} · {report.dateLabel} · Variance{" "}
          {currency.format(report.variance)} ({report.varianceStatus})
        </span>
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", expanded && "rotate-90")} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {detail === "loading" && <p className="px-5 py-8 text-center text-sm text-slate-400">Memuat laporan...</p>}
          {detail === "error" && <p className="px-5 py-8 text-center text-sm text-rose-500">Gagal memuat laporan ini.</p>}
          {detail && typeof detail === "object" && <HistoricalReportDetail detail={detail} />}

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white px-5 py-3.5">
            {!rejecting ? (
              <>
                <Button variant="success" size="sm" onClick={() => decide("APPROVED")} disabled={pending}>
                  <Check className="h-3.5 w-3.5" /> Terverifikasi
                </Button>
                <Button variant="danger" size="sm" onClick={() => setRejecting(true)} disabled={pending}>
                  <X className="h-3.5 w-3.5" /> Tolak Laporan
                </Button>
              </>
            ) : (
              <div className="w-full space-y-2">
                <Textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Jelaskan apa yang perlu dikoreksi, agar pramuniaga tahu apa yang salah..."
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" onClick={() => decide("REJECTED", rejectNotes || undefined)} disabled={pending}>
                    {pending ? "Mengirim..." : "Konfirmasi Tolak"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRejecting(false)} disabled={pending}>
                    Batal
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function PendingReportList({ reports }: { reports: PendingReport[] }) {
  if (reports.length === 0) {
    return <li className="px-5 py-8 text-center text-sm text-slate-400">Tidak ada.</li>;
  }
  return (
    <>
      {reports.map((r) => (
        <ReportRow key={r.id} report={r} />
      ))}
    </>
  );
}
