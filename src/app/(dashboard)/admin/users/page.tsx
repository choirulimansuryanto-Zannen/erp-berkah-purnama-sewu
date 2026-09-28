import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:manage_users")) redirect("/dashboard");

  const [users, outlets] = await Promise.all([
    prisma.user.findMany({ include: { outlet: true }, orderBy: { createdAt: "desc" } }),
    prisma.outlet.findMany({ orderBy: { name: "asc" } }),
  ]);

  const outletsWithStaffing = outlets.map((o) => {
    const staffing = { SHIFT_1: 0, SHIFT_2: 0, FULLSHIFT: 0 };
    for (const u of users) {
      if (u.role === "PRAMUNIAGA" && u.outletId === o.id && u.status === "ACTIVE") {
        staffing[u.shift] += 1;
      }
    }
    return { id: o.id, name: o.name, staffing };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Kelola akun, role, dan penempatan outlet." />

      <CreateUserForm outlets={outletsWithStaffing} />

      <Card>
        <CardHeader>
          <CardTitle>Semua User ({users.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Outlet</Th>
              <Th>Shift</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <tbody>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td className="font-medium text-slate-900">{u.name}</Td>
                <Td>{u.email}</Td>
                <Td>
                  <Badge tone="brand">{u.role.replace(/_/g, " ")}</Badge>
                </Td>
                <Td>{u.outlet?.name ?? "-"}</Td>
                <Td>{u.role === "PRAMUNIAGA" ? u.shift.replace("_", " ") : "-"}</Td>
                <Td>
                  <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>{u.status}</Badge>
                </Td>
              </Tr>
            ))}
            {users.length === 0 && <EmptyRow colSpan={6}>Belum ada user.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
