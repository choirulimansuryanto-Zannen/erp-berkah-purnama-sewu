"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Region = { id: string; name: string };

export function CreateOutletForm({ regions }: { regions: Region[] }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [regionId, setRegionId] = useState(regions[0]?.id ?? "");
  const [dailyTarget, setDailyTarget] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/admin/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address: address || undefined,
          regionId,
          dailyTarget: dailyTarget ? Number(dailyTarget) : 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Outlet dibuat: ${name}`);
        setName("");
        setAddress("");
        setDailyTarget("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Outlet</CardTitle>
      </CardHeader>
      <CardContent>
        {regions.length === 0 ? (
          <p className="text-sm text-slate-500">Buat region terlebih dahulu sebelum menambah outlet.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Nama Outlet</Label>
                <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Region</Label>
                <Select className="mt-1" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Alamat (opsional)</Label>
                <Input className="mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <Label>Target Harian (Rp)</Label>
                <Input className="mt-1" type="number" value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} />
              </div>
            </div>
            <Button onClick={submit} disabled={pending || !name || !regionId} className="mt-4">
              {pending ? "Menyimpan..." : "Tambah Outlet"}
            </Button>
          </>
        )}
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
