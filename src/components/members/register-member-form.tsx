"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RegisterMemberForm() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/members/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, birthDate: birthDate || undefined, city: city || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Member terdaftar: ${data.code} (tier ${data.tier}).`);
        setPhone("");
        setName("");
        setBirthDate("");
        setCity("");
      } else {
        setMessage(typeof data.error === "string" ? data.error : "Gagal mendaftarkan member.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftarkan Member Baru</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>No. HP</Label>
            <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="No. HP" />
          </div>
          <div>
            <Label>Nama</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama" />
          </div>
          <div>
            <Label>Tanggal Lahir (opsional)</Label>
            <Input className="mt-1" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <Label>Kota (opsional)</Label>
            <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Kota domisili" />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !phone || !name} className="mt-3">
          {pending ? "Mendaftarkan..." : "Daftar"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
