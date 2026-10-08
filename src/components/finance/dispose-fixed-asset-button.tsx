"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function DisposeFixedAssetButton({ id, description }: { id: string; description: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function dispose() {
    if (!confirm(`Tandai "${description}" sebagai dilepas (disposed)? Aset tidak akan dihapus, hanya disembunyikan dari daftar aktif.`)) return;
    startTransition(async () => {
      await fetch(`/api/finance/fixed-asset/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISPOSED" }),
      });
      router.refresh();
    });
  }

  return (
    <button onClick={dispose} disabled={pending} className="text-[11px] font-semibold text-rose-600 hover:underline disabled:opacity-50">
      {pending ? "..." : "Dispose"}
    </button>
  );
}
