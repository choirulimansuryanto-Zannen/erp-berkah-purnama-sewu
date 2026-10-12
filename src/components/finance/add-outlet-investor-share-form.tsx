"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

type Outlet = { id: string; name: string };

// Adds a new outlet-level investor MoU share — bottom of the Sharing
// Profit filter card. Nama Investor is free text (matches an existing
// investor by exact name if one already exists, otherwise creates a new
// one) rather than a dropdown, since the business types it fresh each
// time; Outlet/Slot/Jenis Share are all dropdowns, and the value cell
// switches between "%" and "Rp" depending on Jenis Share, same as the
// business's own format.
export function AddOutletInvestorShareForm({ outlets }: { outlets: Outlet[] }) {
  const router = useRouter();
  const [investorName, setInvestorName] = useState("");
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [slotNumber, setSlotNumber] = useState("1");
  const [shareType, setShareType] = useState<"PERSEN" | "NOMINAL">("PERSEN");
  const [shareValue, setShareValue] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    setDone(false);
    if (!investorName.trim()) {
      setError("Nama Investor wajib diisi.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/finance/outlet-investor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorName: investorName.trim(),
          outletId,
          slotNumber: Number(slotNumber),
          shareType,
          shareValue: Number(shareValue) || 0,
          openingBalance: Number(openingBalance) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setInvestorName("");
        setShareValue("");
        setOpeningBalance("0");
        setDone(true);
        router.refresh();
      } else {
        setError(typeof data.error === "string" ? data.error : "Gagal menambahkan investor.");
      }
    });
  }

  const fieldClass = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs";

  return (
    <div className="border-t border-slate-200 bg-slate-50 p-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Tambah Investor Outlet</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Nama Investor</label>
          <input type="text" value={investorName} onChange={(e) => setInvestorName(e.target.value)} placeholder="Ketik nama" className={fieldClass} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Outlet</label>
          <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className={fieldClass}>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Slot Investor</label>
          <select value={slotNumber} onChange={(e) => setSlotNumber(e.target.value)} className={fieldClass}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Investor {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Jenis Share</label>
          <select value={shareType} onChange={(e) => setShareType(e.target.value as "PERSEN" | "NOMINAL")} className={fieldClass}>
            <option value="PERSEN">Persen</option>
            <option value="NOMINAL">Nominal</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-amber-700">{shareType === "PERSEN" ? "Persentase (%)" : "Nominal (Rp)"}</label>
          <input
            type="number"
            min="0"
            step="any"
            value={shareValue}
            onChange={(e) => setShareValue(e.target.value)}
            placeholder={shareType === "PERSEN" ? "mis. 2.5" : "mis. 500000"}
            className={`${fieldClass} border-amber-300 bg-amber-50`}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500" title="Saldo Accum./Transfer-Shared historis sebelum sistem ini mencatat — hanya dipakai untuk investor baru">
            Saldo Awal (opsional)
          </label>
          <input type="number" step="any" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className={fieldClass} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg bg-brand-900 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> {pending ? "Menyimpan..." : "Tambah Investor"}
        </button>
        {done && <span className="text-xs font-semibold text-emerald-600">✓ Tersimpan</span>}
        {error && <span className="text-xs font-semibold text-rose-600">{error}</span>}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Nama Investor diketik bebas — kalau sudah ada investor aktif dengan nama persis sama, MoU outlet baru ini otomatis digabung ke investor tsb (bukan
        membuat profil baru); ketik nama persis sama untuk menambah outlet ke investor yang sudah ada. Saldo Awal hanya berlaku saat investor benar-benar
        baru pertama kali dibuat.
      </p>
    </div>
  );
}
