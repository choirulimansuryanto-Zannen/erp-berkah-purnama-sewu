"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (newPassword.length < 8) {
      setMessage({ ok: false, text: "Password minimal 8 karakter." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ ok: false, text: "Konfirmasi password tidak cocok." });
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setMessage({ ok: false, text: error.message });
      } else {
        setMessage({ ok: true, text: "Password berhasil diubah." });
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ubah Password</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Password Baru</Label>
            <Input
              className="mt-1"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label>Konfirmasi Password Baru</Label>
            <Input
              className="mt-1"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !newPassword || !confirmPassword} className="mt-4">
          {pending ? "Menyimpan..." : "Ubah Password"}
        </Button>
        {message && (
          <p className={`mt-2 text-sm ${message.ok ? "text-emerald-600" : "text-rose-600"}`}>{message.text}</p>
        )}
      </CardContent>
    </Card>
  );
}
