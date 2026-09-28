"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DecisionButtons({
  endpoint,
  approveBody = { status: "APPROVED" },
  rejectBody = { status: "REJECTED" },
}: {
  endpoint: string;
  approveBody?: Record<string, unknown>;
  rejectBody?: Record<string, unknown>;
}) {
  const [pending, startTransition] = useTransition();

  function decide(body: Record<string, unknown>) {
    startTransition(async () => {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      window.location.reload();
    });
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Button variant="success" size="sm" onClick={() => decide(approveBody)} disabled={pending}>
        <Check className="h-3.5 w-3.5" />
        Approve
      </Button>
      <Button variant="danger" size="sm" onClick={() => decide(rejectBody)} disabled={pending}>
        <X className="h-3.5 w-3.5" />
        Reject
      </Button>
    </div>
  );
}
