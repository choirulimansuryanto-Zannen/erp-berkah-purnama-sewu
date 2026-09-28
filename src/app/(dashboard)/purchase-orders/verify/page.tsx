import { redirect } from "next/navigation";
import { FileCheck2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";

export default async function VerifyPurchaseOrdersPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "SPV") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Verifikasi PO" description="Setujui atau tolak Purchase Order yang diajukan outlet di wilayah Anda." />
      <ComingSoon
        icon={<FileCheck2 className="h-7 w-7" />}
        title="Verifikasi PO sedang dibangun"
        description="Antrean Purchase Order yang menunggu keputusan Anda, sama seperti pola Verifikasi Laporan."
        plannedFeatures={[
          "Daftar PO berstatus Menunggu, dipersempit ke outlet di wilayah Anda",
          "Setujui, tolak, atau minta revisi jumlah/item sebelum diteruskan",
          "Riwayat keputusan tercatat otomatis di Histori PO",
        ]}
      />
    </div>
  );
}
