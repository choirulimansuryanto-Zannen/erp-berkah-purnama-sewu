"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

const NEXT_STATUS: Record<string, "ACTIVE" | "ENDED" | null> = {
  DRAFT: "ACTIVE",
  ACTIVE: "ENDED",
  ENDED: null,
};

const NEXT_LABEL: Record<string, string> = {
  DRAFT: "Aktifkan",
  ACTIVE: "Akhiri",
};

export function CampaignStatusControl({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const next = NEXT_STATUS[status];

  if (!next) return null;

  function advance() {
    startTransition(async () => {
      await fetch(`/api/marketing/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      window.location.reload();
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={advance} disabled={pending}>
      {pending ? "..." : NEXT_LABEL[status]}
    </Button>
  );
}
