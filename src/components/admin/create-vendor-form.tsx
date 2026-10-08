"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateVendorForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await fetch("/api/admin/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Vendor dibuat: ${name}`);
        setName("");
        window.location.reload();
      } else {
        setMessage(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Vendor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label>Nama Vendor</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Vendor" />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !name} className="mt-4">
          {pending ? "Menyimpan..." : "Tambah Vendor"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
