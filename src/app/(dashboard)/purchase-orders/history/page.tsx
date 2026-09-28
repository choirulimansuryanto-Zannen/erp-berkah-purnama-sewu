import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";

export default async function PurchaseOrderHistoryPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "SPV") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Histori PO" description="Arsip Purchase Order yang sudah diproses di wilayah Anda." />
      <ComingSoon
        icon={<History className="h-7 w-7" />}
        title="Histori PO sedang dibangun"
        description="Arsip lengkap seluruh Purchase Order — disetujui, ditolak, maupun sudah diterima outlet."
        plannedFeatures={[
          "Filter berdasarkan outlet, status, dan rentang tanggal",
          "Ringkasan nilai/volume PO per outlet dan per wilayah",
          "Export ke CSV untuk rekonsiliasi gudang",
        ]}
      />
    </div>
  );
}
