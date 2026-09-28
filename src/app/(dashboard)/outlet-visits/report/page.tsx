import { redirect } from "next/navigation";
import { NotebookPen } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";

export default async function OutletVisitReportPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "SPV") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Report Kunjungan Outlet" description="Catatan hasil setiap kunjungan Anda ke outlet di wilayah Anda." />
      <ComingSoon
        icon={<NotebookPen className="h-7 w-7" />}
        title="Report Kunjungan Outlet sedang dibangun"
        description="Formulir catatan hasil kunjungan — temuan, tindak lanjut, dan foto — terhubung ke setiap sesi Absen Kunjungan Outlet."
        plannedFeatures={[
          "Formulir temuan per kunjungan (kebersihan, kepatuhan SOP, kondisi stok)",
          "Lampiran foto langsung dari kunjungan",
          "Riwayat report per outlet untuk memantau tren dari waktu ke waktu",
        ]}
      />
    </div>
  );
}
