import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { CreateRosterForm } from "@/components/admin/create-roster-form";
import { RosterRow } from "@/components/admin/roster-row";

export default async function PramuniagaRosterPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const roster = await prisma.pramuniagaRoster.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roster Pramuniaga"
        description="Daftar nama pramuniaga yang bisa dipilih saat check-in — terpisah dari akun login (outlet/shift login tetap terkunci sesuai penugasan)."
      />

      <CreateRosterForm />

      <Card>
        <CardHeader>
          <CardTitle>Semua Nama ({roster.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {roster.map((r) => (
              <RosterRow key={r.id} id={r.id} name={r.name} status={r.status} />
            ))}
            {roster.length === 0 && <EmptyRow colSpan={3}>Belum ada nama pramuniaga.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
