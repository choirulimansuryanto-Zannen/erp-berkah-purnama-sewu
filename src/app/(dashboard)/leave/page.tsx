import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveRequestForm } from "@/components/attendance/leave-request-form";
import { PageHeader } from "@/components/ui/page-header";

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function LeavePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "PRAMUNIAGA" && user.role !== "SPV") redirect("/dashboard");

  const myRequests = await prisma.leavePermission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Izin, Sakit & Libur" description="Kelola pengajuan Izin Off ataupun Surat Sakit Anda secara Daring." />
      <LeaveRequestForm
        myRequests={myRequests.map((r) => ({
          id: r.id,
          type: r.type,
          dateFrom: toDateOnly(r.dateFrom),
          dateTo: toDateOnly(r.dateTo),
          reason: r.reason,
          status: r.status,
        }))}
      />
    </div>
  );
}
