"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

// `date` arrives as a plain "YYYY-MM-DD" string (see summary-setoran-table's
// caller) — reformatted here by splitting the string, never by constructing
// a `Date` and reading it back, which is exactly the step that can silently
// shift a @db.Date value by a day depending on the machine's timezone.
function formatDateStr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export type OutletSummaryRow = {
  id: string;
  name: string;
  count: number;
  omset: number;
  nonTunai: number;
  potongan: number;
  expenses: number;
  kasbon: number;
  setoran: number;
  actual: number;
  variance: number;
  setoranVia: { brankas: number; bca: number; mandiri: number };
};

export type DailyReportRow = {
  id: string;
  date: string; // "YYYY-MM-DD", not a timestamp — see formatDateStr
  pramuniagaName: string;
  omset: number;
  nonTunai: number;
  potongan: number;
  expenses: number;
  kasbon: number;
  setoran: number;
  actual: number;
  variance: number;
};

function varianceTone(variance: number): "success" | "danger" | "warning" {
  return Math.abs(variance) < 1 ? "success" : variance < 0 ? "danger" : "warning";
}

// A single outlet row in Summary Setoran Bersih can be expanded (chevron,
// or clicking anywhere on the row) to reveal the day-by-day DailyReport
// rows that make up its monthly totals — so a monthly figure here is never
// a dead end, it's one click away from the exact dates/reports behind it.
export type SummaryTotals = {
  omset: number;
  nonTunai: number;
  potongan: number;
  expenses: number;
  kasbon: number;
  setoran: number;
  actual: number;
  variance: number;
  setoranVia: { brankas: number; bca: number; mandiri: number };
};

export function SummarySetoranTable({
  rows,
  dailyByOutlet,
  totals,
}: {
  rows: OutletSummaryRow[];
  dailyByOutlet: Record<string, DailyReportRow[]>;
  totals: SummaryTotals;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <table className="w-full min-w-max border-collapse text-sm">
        <tbody>
          <EmptyRow colSpan={13}>Belum ada laporan terverifikasi pada periode ini.</EmptyRow>
        </tbody>
      </table>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr>
            <th rowSpan={2} className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Outlet
            </th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Jml Laporan
            </th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Omset
            </th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Non-Tunai
            </th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Potongan
            </th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Beban Operasional
            </th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Kasbon
            </th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Setoran Fisik
            </th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Actual Cash
            </th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Variance
            </th>
            <th colSpan={3} className="sticky top-0 z-20 h-9 border-b border-l-2 border-slate-300 bg-slate-100 px-5 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              Setoran Via
            </th>
            <th rowSpan={2} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-5 py-2.5"></th>
          </tr>
          <tr>
            <th className="sticky top-9 z-20 h-8 border-b border-l-2 border-slate-300 bg-slate-100 px-4 py-1.5 text-right text-[11px] font-semibold uppercase text-slate-500">1. Cash - Brankas</th>
            <th className="sticky top-9 z-20 h-8 border-b border-slate-200 bg-slate-100 px-4 py-1.5 text-right text-[11px] font-semibold uppercase text-slate-500">2. Transfer - BCA</th>
            <th className="sticky top-9 z-20 h-8 border-b border-slate-200 bg-slate-100 px-4 py-1.5 text-right text-[11px] font-semibold uppercase text-slate-500">3. Transfer - Mandiri</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOpen = expanded.has(r.id);
            const daily = dailyByOutlet[r.id] ?? [];
            return (
              <Fragment key={r.id}>
                <Tr className={isOpen ? "bg-accent-50/40" : ""}>
                  <Td className="sticky left-0 z-10 bg-white">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggle(r.id)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Tutup rincian harian ${r.name}` : `Lihat rincian harian ${r.name}`}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      <Link
                        href={`/finance/outlet/${r.id}`}
                        className="font-semibold text-accent-700 hover:text-accent-800 hover:underline"
                        title="Buka laporan lengkap 8 sheet outlet ini"
                      >
                        {r.name}
                      </Link>
                    </div>
                  </Td>
                  <Td>{r.count}</Td>
                  <Td>{currency.format(r.omset)}</Td>
                  <Td>{currency.format(r.nonTunai)}</Td>
                  <Td>{currency.format(r.potongan)}</Td>
                  <Td>{currency.format(r.expenses)}</Td>
                  <Td className="text-amber-700">{currency.format(r.kasbon)}</Td>
                  <Td className="font-semibold">{currency.format(r.setoran)}</Td>
                  <Td>{currency.format(r.actual)}</Td>
                  <Td>
                    <Badge tone={varianceTone(r.variance)}>{currency.format(r.variance)}</Badge>
                  </Td>
                  <Td className="border-l-2 border-slate-200 text-right tabular-nums">{r.setoranVia.brankas > 0 ? currency.format(r.setoranVia.brankas) : "-"}</Td>
                  <Td className="text-right tabular-nums">{r.setoranVia.bca > 0 ? currency.format(r.setoranVia.bca) : "-"}</Td>
                  <Td className="text-right tabular-nums">{r.setoranVia.mandiri > 0 ? currency.format(r.setoranVia.mandiri) : "-"}</Td>
                  <Td>
                    <Link
                      href={`/finance/outlet/${r.id}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-accent-50 px-2.5 py-1.5 text-xs font-bold text-accent-700 hover:bg-accent-100"
                    >
                      Detail 8 Sheet <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Td>
                </Tr>

                {isOpen && (
                  <tr>
                    <td colSpan={13} className="bg-slate-50/70 p-0">
                      <div className="px-5 py-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                          Rincian Laporan Harian — {r.name} ({daily.length} laporan)
                        </p>
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <table className="w-full min-w-max border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="px-3 py-2 text-left font-semibold uppercase text-slate-500">Tanggal</th>
                                <th className="px-3 py-2 text-left font-semibold uppercase text-slate-500">Pramuniaga</th>
                                <th className="px-3 py-2 text-right font-semibold uppercase text-slate-500">Omset</th>
                                <th className="px-3 py-2 text-right font-semibold uppercase text-slate-500">Non-Tunai</th>
                                <th className="px-3 py-2 text-right font-semibold uppercase text-slate-500">Potongan</th>
                                <th className="px-3 py-2 text-right font-semibold uppercase text-slate-500">Beban Operasional</th>
                                <th className="px-3 py-2 text-right font-semibold uppercase text-slate-500">Kasbon</th>
                                <th className="px-3 py-2 text-right font-semibold uppercase text-slate-500">Setoran Fisik</th>
                                <th className="px-3 py-2 text-right font-semibold uppercase text-slate-500">Actual Cash</th>
                                <th className="px-3 py-2 text-right font-semibold uppercase text-slate-500">Variance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {daily.map((d) => (
                                <tr key={d.id} className="border-t border-slate-100">
                                  <td className="px-3 py-2 font-medium text-slate-800">{formatDateStr(d.date)}</td>
                                  <td className="px-3 py-2 text-slate-600">{d.pramuniagaName}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{currency.format(d.omset)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{currency.format(d.nonTunai)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{currency.format(d.potongan)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{currency.format(d.expenses)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-amber-700">{d.kasbon > 0 ? currency.format(d.kasbon) : "-"}</td>
                                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{currency.format(d.setoran)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{currency.format(d.actual)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    <Badge tone={varianceTone(d.variance)}>{currency.format(d.variance)}</Badge>
                                  </td>
                                </tr>
                              ))}
                              {daily.length === 0 && (
                                <tr>
                                  <td colSpan={10} className="px-3 py-4 text-center text-slate-400">
                                    Tidak ada laporan harian pada periode ini.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-brand-900">
            <td className="sticky left-0 z-10 bg-slate-50 px-5 py-2.5" colSpan={2}>
              Total
            </td>
            <td className="px-5 py-2.5">{currency.format(totals.omset)}</td>
            <td className="px-5 py-2.5">{currency.format(totals.nonTunai)}</td>
            <td className="px-5 py-2.5">{currency.format(totals.potongan)}</td>
            <td className="px-5 py-2.5">{currency.format(totals.expenses)}</td>
            <td className="px-5 py-2.5 text-amber-700">{currency.format(totals.kasbon)}</td>
            <td className="px-5 py-2.5">{currency.format(totals.setoran)}</td>
            <td className="px-5 py-2.5">{currency.format(totals.actual)}</td>
            <td className="px-5 py-2.5">{currency.format(totals.variance)}</td>
            <td className="border-l-2 border-slate-300 px-5 py-2.5 text-right tabular-nums">{currency.format(totals.setoranVia.brankas)}</td>
            <td className="px-5 py-2.5 text-right tabular-nums">{currency.format(totals.setoranVia.bca)}</td>
            <td className="px-5 py-2.5 text-right tabular-nums">{currency.format(totals.setoranVia.mandiri)}</td>
            <td className="px-5 py-2.5"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
