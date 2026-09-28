import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";

export default async function OutletVisitsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "SPV") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Absen Kunjungan Outlet" description="Check-in kunjungan fisik Anda ke outlet-outlet di wilayah Anda." />
      <ComingSoon
        icon={<MapPin className="h-7 w-7" />}
        title="Absen Kunjungan Outlet sedang dibangun"
        description="Presensi khusus untuk kunjungan Anda ke outlet — terpisah dari presensi masuk/pulang harian Anda sendiri."
        plannedFeatures={[
          "Check-in/check-out per kunjungan, dengan titik koordinat GPS outlet",
          "Riwayat kunjungan per outlet — kapan terakhir dikunjungi",
          "Terhubung ke Report Kunjungan Outlet untuk catatan hasil kunjungan",
        ]}
      />
    </div>
  );
}
