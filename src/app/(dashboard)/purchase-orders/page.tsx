import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";

export default async function PurchaseOrdersPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "SPV") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Order Outlet" description="Pengajuan Purchase Order dari outlet-outlet di wilayah Anda." />
      <ComingSoon
        icon={<ClipboardList className="h-7 w-7" />}
        title="Purchase Order sedang dibangun"
        description="Modul pengajuan barang (saldo masuk) dari outlet ke gudang/wilayah — menggantikan penyesuaian stok manual."
        plannedFeatures={[
          "Outlet mengajukan PO per bahan baku/produk beserta jumlah yang dibutuhkan",
          "Riwayat status: Diajukan → Diverifikasi SPV → Dikirim → Diterima Outlet",
          "Terhubung otomatis ke Riwayat Summary Sisa Stock setelah PO diterima",
        ]}
      />
    </div>
  );
}
