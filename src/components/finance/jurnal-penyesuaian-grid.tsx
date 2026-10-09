"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdjustingGridLine } from "@/lib/accounting";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

type Account = { id: string; code: string; name: string };

const cellInputClass =
  "w-full min-w-0 rounded border-0 bg-transparent px-1.5 py-1 text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50";

// One row per JournalEntryLine — Tgl/TRX_BOOKS/line are always derived
// from the selected period (see lib/accounting.ts), never typed by hand.
// COA, Debit/Credit, Remark, Cost Description and Cost Centre are all
// editable directly in the grid, auto-saving onBlur/change via PATCH
// /api/finance/adjusting-entries/line/[lineId] (which keeps the pair
// balanced server-side — see updateAdjustingEntryLine).
function GridRow({ line, accounts, isFirstOfPair }: { line: AdjustingGridLine; accounts: Account[]; isFirstOfPair: boolean }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(line.accountId);
  const [amount, setAmount] = useState(String(line.debit > 0 ? line.debit : line.credit));
  const [remark, setRemark] = useState(line.remark);
  const [costDescription, setCostDescription] = useState(line.costDescription);
  const [costCentre, setCostCentre] = useState(line.costCentre);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/adjusting-entries/line/${line.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setFailed(!res.ok);
      if (res.ok) router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
  }

  return (
    <tr className={`border-b border-slate-100 text-xs ${isFirstOfPair ? "border-t-2 border-t-slate-200" : ""} odd:bg-white even:bg-slate-50/60`}>
      <td className="px-2 py-1 text-slate-500">{dateFormat.format(line.date)}</td>
      <td className="px-2 py-1 font-mono text-slate-500">{line.trxBooks}</td>
      <td className="px-2 py-1 text-center text-slate-400">{line.lineNo}</td>
      <td className="px-1 py-1" title={failed ? "Gagal menyimpan — coba lagi" : undefined}>
        <select
          className={`${cellInputClass} ${failed ? "ring-1 ring-inset ring-red-500" : ""}`}
          value={accountId}
          disabled={saving}
          onChange={(e) => {
            setAccountId(e.target.value);
            save({ accountId: e.target.value });
          }}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              [{a.code}] {a.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-1 py-1">
        {line.lineNo === 1 ? (
          <input
            className={`${cellInputClass} text-right tabular-nums`}
            type="number"
            step="any"
            min="0"
            value={amount}
            disabled={saving}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => save({ amount: Number(amount || 0) })}
            onKeyDown={onKeyDown}
          />
        ) : (
          <span className="block px-1.5 text-right text-slate-300">-</span>
        )}
      </td>
      <td className="px-1 py-1">
        {line.lineNo === 2 ? (
          <input
            className={`${cellInputClass} text-right tabular-nums`}
            type="number"
            step="any"
            min="0"
            value={amount}
            disabled={saving}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => save({ amount: Number(amount || 0) })}
            onKeyDown={onKeyDown}
          />
        ) : (
          <span className="block px-1.5 text-right text-slate-300">-</span>
        )}
      </td>
      <td className="px-1 py-1">
        <input
          className={cellInputClass}
          type="text"
          value={remark}
          disabled={saving}
          onChange={(e) => setRemark(e.target.value)}
          onBlur={() => save({ remark })}
          onKeyDown={onKeyDown}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={cellInputClass}
          type="text"
          value={costDescription}
          disabled={saving}
          onChange={(e) => setCostDescription(e.target.value)}
          onBlur={() => save({ costDescription })}
          onKeyDown={onKeyDown}
        />
      </td>
      <td className="px-1 py-1">
        <input
          className={cellInputClass}
          type="text"
          value={costCentre}
          disabled={saving}
          onChange={(e) => setCostCentre(e.target.value)}
          onBlur={() => save({ costCentre })}
          onKeyDown={onKeyDown}
        />
      </td>
    </tr>
  );
}

function AddTransactionRow({ accounts, year, month }: { accounts: Account[]; year: number; month: number }) {
  const router = useRouter();
  const [debitAccountId, setDebitAccountId] = useState(accounts[0]?.id ?? "");
  const [creditAccountId, setCreditAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/adjusting-entries/grid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, debitAccountId, creditAccountId }),
      });
      const data = await res.json();
      if (res.ok) {
        router.refresh();
      } else {
        setError(typeof data.error === "string" ? data.error : "Gagal membuat transaksi");
      }
    } catch {
      setError("Gagal membuat transaksi");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
      <div className="min-w-[220px] flex-1">
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Akun Debit (baru)</label>
        <select className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              [{a.code}] {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[220px] flex-1">
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Akun Kredit (baru)</label>
        <select className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              [{a.code}] {a.name}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={submit}
        disabled={pending || !debitAccountId || !creditAccountId}
        className="rounded-lg bg-brand-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {pending ? "Menambahkan..." : "+ Tambah Transaksi"}
      </button>
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function JurnalPenyesuaianGrid({ lines, accounts, year, month }: { lines: AdjustingGridLine[]; accounts: Account[]; year: number; month: number }) {
  // Group consecutively so the "first of pair" top-border divider lands
  // between transactions, not mid-pair.
  const seen = new Set<string>();
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px] border-collapse text-xs">
          <thead>
            <tr className="bg-brand-950 text-white">
              <th className="px-2 py-2 text-left">Tgl</th>
              <th className="px-2 py-2 text-left">TRX_BOOKS</th>
              <th className="px-2 py-2 text-center">Line</th>
              <th className="min-w-[260px] px-2 py-2 text-left">COA / Akun</th>
              <th className="px-2 py-2 text-right">Debit</th>
              <th className="px-2 py-2 text-right">Credit</th>
              <th className="min-w-[180px] px-2 py-2 text-left">Remarks</th>
              <th className="min-w-[160px] px-2 py-2 text-left">Cost Description</th>
              <th className="min-w-[130px] px-2 py-2 text-left">Cost Centre</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const isFirstOfPair = !seen.has(l.journalEntryId);
              seen.add(l.journalEntryId);
              return <GridRow key={l.id} line={l} accounts={accounts} isFirstOfPair={isFirstOfPair} />;
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                  Belum ada jurnal penyesuaian pada periode ini.
                </td>
              </tr>
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="bg-brand-900 font-bold text-white">
                <td colSpan={4} className="px-2 py-2">
                  TOTAL
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{currency.format(totalDebit)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{currency.format(totalCredit)}</td>
                <td colSpan={3} className={`px-2 py-2 text-xs font-normal ${Math.abs(totalDebit - totalCredit) > 0.01 ? "text-rose-300" : "text-emerald-300"}`}>
                  {Math.abs(totalDebit - totalCredit) > 0.01 ? "⚠ Tidak balance — periksa kembali" : "✓ Balance"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <AddTransactionRow accounts={accounts} year={year} month={month} />
    </div>
  );
}
