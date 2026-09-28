"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CATEGORIES = ["ALACARTE", "PAKET_ONLINE", "PAKET_MBG", "PAKET_KOPDES", "PAKET_PAHLAWAN"] as const;
const CHANNELS = ["CASH", "CASHLESS", "GRAB", "GOFOOD", "SHOPEE", "QPON", "TIKTOK"] as const;

type Rules = Record<(typeof CATEGORIES)[number], Set<(typeof CHANNELS)[number]>>;

export function ChannelRulesForm({
  initialRules,
}: {
  initialRules: { category: string; allowedChannels: string[] }[];
}) {
  const [rules, setRules] = useState<Rules>(() => {
    const map = {} as Rules;
    for (const category of CATEGORIES) {
      const existing = initialRules.find((r) => r.category === category);
      map[category] = new Set((existing?.allowedChannels ?? []) as (typeof CHANNELS)[number][]);
    }
    return map;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(category: (typeof CATEGORIES)[number], channel: (typeof CHANNELS)[number]) {
    setRules((prev) => {
      const next = { ...prev, [category]: new Set(prev[category]) };
      if (next[category].has(channel)) next[category].delete(channel);
      else next[category].add(channel);
      return next;
    });
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/channel-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: CATEGORIES.map((category) => ({ category, allowedChannels: Array.from(rules[category]) })),
        }),
      });
      const data = await res.json();
      setMessage(res.ok ? "Aturan channel tersimpan." : (typeof data.error === "string" ? data.error : "Gagal menyimpan."));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ketersediaan Channel per Kategori Menu</CardTitle>
      </CardHeader>
      <div className="p-5">
        <p className="mb-4 text-xs text-slate-500">
          Centang channel yang boleh menjual kategori tersebut. Kosongkan semua centang untuk kategori yang berlaku di
          semua channel (tanpa pembatasan).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kategori
                </th>
                {CHANNELS.map((c) => (
                  <th key={c} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category) => (
                <tr key={category} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 font-medium text-slate-800">{category.replace("_", " ")}</td>
                  {CHANNELS.map((channel) => (
                    <td key={channel} className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={rules[category].has(channel)}
                        onChange={() => toggle(category, channel)}
                        className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button onClick={submit} disabled={pending} className="mt-4">
          {pending ? "Menyimpan..." : "Simpan Aturan"}
        </Button>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </div>
    </Card>
  );
}
