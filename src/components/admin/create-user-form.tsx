"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ROLES = [
  "PRAMUNIAGA",
  "SPV",
  "OFFICE",
  "OPS_ADMIN",
  "FA_ADMIN",
  "HRGA_ADMIN",
  "MARKETING_ADMIN",
  "MASTER_ADMIN",
] as const;

const SHIFTS = ["SHIFT_1", "SHIFT_2", "FULLSHIFT"] as const;
const SHIFT_LABELS: Record<(typeof SHIFTS)[number], string> = {
  SHIFT_1: "Shift 1",
  SHIFT_2: "Shift 2",
  FULLSHIFT: "Fullshift",
};

type Outlet = {
  id: string;
  name: string;
  staffing: Record<(typeof SHIFTS)[number], number>;
};

export function CreateUserForm({ outlets }: { outlets: Outlet[] }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("PRAMUNIAGA");
  const [outletId, setOutletId] = useState("");
  const [shift, setShift] = useState<(typeof SHIFTS)[number]>("FULLSHIFT");
  const [tempPassword, setTempPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedOutlet = outlets.find((o) => o.id === outletId);

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          role,
          outletId: outletId || undefined,
          shift: role === "PRAMUNIAGA" ? shift : undefined,
          tempPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`User dibuat: ${data.user_id}`);
        setEmail("");
        setName("");
        setTempPassword("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buat User Baru</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Email</Label>
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Nama</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Role</Label>
            <Select className="mt-1" value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Outlet (opsional)</Label>
            <Select className="mt-1" value={outletId} onChange={(e) => setOutletId(e.target.value)}>
              <option value="">-</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
          {role === "PRAMUNIAGA" && (
            <div>
              <Label>Shift</Label>
              <Select className="mt-1" value={shift} onChange={(e) => setShift(e.target.value as (typeof SHIFTS)[number])}>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {SHIFT_LABELS[s]}
                  </option>
                ))}
              </Select>
              {selectedOutlet && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Staffing outlet ini saat ini —{" "}
                  {SHIFTS.map((s) => `${SHIFT_LABELS[s]}: ${selectedOutlet.staffing[s]}`).join(" · ")}
                </p>
              )}
            </div>
          )}
          <div>
            <Label>Password Sementara</Label>
            <Input className="mt-1" type="text" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !email || !name || tempPassword.length < 8} className="mt-4">
          {pending ? "Membuat..." : "Buat User"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        <p className="mt-2 text-xs text-slate-400">
          Default 1 pramuniaga per outlet (Fullshift). Tambahkan pramuniaga lagi di shift yang sama untuk menambah
          coverage, atau di shift berbeda untuk membagi Shift 1 / Shift 2 — total pramuniaga per outlet bisa lebih
          dari 1.
        </p>
      </CardContent>
    </Card>
  );
}
