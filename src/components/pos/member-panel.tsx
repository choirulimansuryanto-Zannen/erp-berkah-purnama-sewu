"use client";

import { useState, useTransition } from "react";
import { Gift, IdCard, Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Input } from "@/components/ui/input";

export type SelectedMember = { member_id: string; code?: string | null; name: string; tier: string; points: number };
export type VoucherReward = { redemptionId: string; productId: string; productName: string; price: number; qty: number };

function VoucherClaimBox({ memberId, onRedeemed }: { memberId?: string; onRedeemed: (reward: VoucherReward) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function redeem() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Voucher tidak valid.");
        return;
      }
      onRedeemed({
        redemptionId: data.redemption_id,
        productId: data.product.id,
        productName: data.product.name,
        price: data.product.price,
        qty: data.qty,
      });
      setCode("");
    });
  }

  return (
    <div className="border-t border-slate-100 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Gift className="h-3.5 w-3.5 text-gold-500" />
        Masukkan Voucher
      </p>
      <div className="mt-2 flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Kode voucher"
          className="flex-1"
        />
        <Button onClick={redeem} variant="secondary" size="md" className="shrink-0 px-3" disabled={pending || !code}>
          {pending ? "..." : "Gunakan"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function MemberPanel({
  member,
  onMemberChange,
  onVoucherRedeemed,
  outletName,
}: {
  member: SelectedMember | null;
  onMemberChange: (member: SelectedMember | null) => void;
  onVoucherRedeemed: (reward: VoucherReward) => void;
  outletName?: string;
}) {
  const [mode, setMode] = useState<"search" | "register">("search");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regBirthDate, setRegBirthDate] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regError, setRegError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function lookupMember() {
    startTransition(async () => {
      setMemberError(null);
      const res = await fetch(`/api/members/lookup?phone=${encodeURIComponent(memberPhone)}`);
      const data = await res.json();
      if (!res.ok) {
        setMemberError(data.error ?? "Member tidak ditemukan.");
        return;
      }
      onMemberChange(data);
      setMemberPhone("");
    });
  }

  function registerMember() {
    startTransition(async () => {
      setRegError(null);
      const res = await fetch("/api/members/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: regPhone,
          name: regName,
          birthDate: regBirthDate || undefined,
          city: regCity || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(typeof data.error === "string" ? data.error : "Gagal mendaftarkan member.");
        return;
      }
      onMemberChange({ member_id: data.member_id, code: data.code, name: data.name, tier: data.tier, points: data.points_balance });
      setRegName("");
      setRegPhone("");
      setRegBirthDate("");
      setRegCity("");
      setMode("search");
    });
  }

  // Already picked — show the compact badge instead of the search/register UI.
  if (member) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 bg-brand-900 px-4 py-2.5">
          <IdCard className="h-4 w-4 text-gold-400" />
          <p className="text-sm font-semibold text-white">Member</p>
        </div>
        <div className="flex items-center justify-between gap-2 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{member.name}</p>
            <p className="text-xs text-slate-400">
              {member.code ?? "-"} · {member.tier} · {member.points} pts
            </p>
          </div>
          <button
            onClick={() => onMemberChange(null)}
            aria-label="Ganti member"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <VoucherClaimBox memberId={member.member_id} onRedeemed={onVoucherRedeemed} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Member</p>
        <button
          onClick={() => {
            setMode((m) => (m === "register" ? "search" : "register"));
            setRegError(null);
          }}
          className="flex items-center gap-1 text-xs font-semibold text-accent-700 hover:text-accent-800"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {mode === "register" ? "Batal" : "Daftar Member Baru"}
        </button>
      </div>

      <div className="border-t border-slate-100 p-4">
        {mode === "search" ? (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  placeholder="Cari member (no. HP)..."
                  className="pl-8"
                />
              </div>
              <Button onClick={lookupMember} variant="secondary" size="md" className="shrink-0 px-3" disabled={pending || !memberPhone}>
                Cari
              </Button>
            </div>
            {memberError && <p className="mt-1.5 text-xs text-rose-600">{memberError}</p>}
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>ID Member</Label>
              <Input className="mt-1" value="" placeholder="Dibuat otomatis oleh sistem" disabled />
            </div>
            <div>
              <Label>Nama</Label>
              <Input className="mt-1" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Nama member" />
            </div>
            <div>
              <Label>No. HP</Label>
              <Input className="mt-1" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="Nomor HP" />
            </div>
            <div>
              <Label>Tanggal Lahir</Label>
              <Input className="mt-1" type="date" value={regBirthDate} onChange={(e) => setRegBirthDate(e.target.value)} />
            </div>
            <div>
              <Label>Kota</Label>
              <Input className="mt-1" value={regCity} onChange={(e) => setRegCity(e.target.value)} placeholder="Kota domisili" />
            </div>
            <div>
              <Label>Outlet</Label>
              <Input className="mt-1" value={outletName ?? "-"} disabled />
            </div>
            {regError && <p className="text-xs text-rose-600">{regError}</p>}
            <Button
              onClick={registerMember}
              disabled={pending || !regName || !regPhone}
              className="w-full"
              size="lg"
            >
              {pending ? "Mendaftarkan..." : "Daftarkan & Pilih"}
            </Button>
          </div>
        )}
      </div>

      {mode === "search" && <VoucherClaimBox onRedeemed={onVoucherRedeemed} />}
    </div>
  );
}
