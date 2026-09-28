"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

const NEXT_STATUS: Record<string, "IN_TRANSIT" | "DELIVERED" | null> = {
  PENDING: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
  DELIVERED: null,
};

const NEXT_LABEL: Record<string, string> = {
  PENDING: "Kirim",
  IN_TRANSIT: "Tandai Diterima",
};

export function DistributionStatusControl({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const next = NEXT_STATUS[status];

  if (!next) return null;

  function advance() {
    startTransition(async () => {
      await fetch(`/api/warehouse/distribution/${id}/status`, {
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
