import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateRegionForm } from "@/components/admin/create-region-form";
import { CreateOutletForm } from "@/components/admin/create-outlet-form";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default async function AdminOutletsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const [regions, outlets, pramuniagaUsers] = await Promise.all([
    prisma.region.findMany({ include: { outlets: true, spv: true }, orderBy: { name: "asc" } }),
    prisma.outlet.findMany({ include: { region: true, manager: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "PRAMUNIAGA", status: "ACTIVE", outletId: { not: null } }, select: { outletId: true, shift: true } }),
  ]);

  const staffingByOutlet = new Map<string, { SHIFT_1: number; SHIFT_2: number; FULLSHIFT: number }>();
  for (const u of pramuniagaUsers) {
    const entry = staffingByOutlet.get(u.outletId!) ?? { SHIFT_1: 0, SHIFT_2: 0, FULLSHIFT: 0 };
    entry[u.shift] += 1;
    staffingByOutlet.set(u.outletId!, entry);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outlets & Regions"
        description={`${outlets.length} outlet di ${regions.length} region — kelola ekspansi ke outlet baru di sini.`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CreateRegionForm />
        <CreateOutletForm regions={regions.map((r) => ({ id: r.id, name: r.name }))} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regions ({regions.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th>SPV</Th>
              <Th>Jumlah Outlet</Th>
            </tr>
          </Thead>
          <tbody>
            {regions.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-slate-900">{r.name}</Td>
                <Td>{r.spv?.name ?? "-"}</Td>
                <Td>{r.outlets.length}</Td>
              </Tr>
            ))}
            {regions.length === 0 && <EmptyRow colSpan={3}>Belum ada region.</EmptyRow>}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outlets ({outlets.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th>Region</Th>
              <Th>Manager</Th>
              <Th>Target Harian</Th>
              <Th>Pramuniaga</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {outlets.map((o) => {
              const staffing = staffingByOutlet.get(o.id) ?? { SHIFT_1: 0, SHIFT_2: 0, FULLSHIFT: 0 };
              const total = staffing.SHIFT_1 + staffing.SHIFT_2 + staffing.FULLSHIFT;
              return (
                <Tr key={o.id}>
                  <Td className="font-medium text-slate-900">{o.name}</Td>
                  <Td>{o.region.name}</Td>
                  <Td>{o.manager?.name ?? "-"}</Td>
                  <Td>{currency.format(Number(o.dailyTarget))}</Td>
                  <Td>
                    <span className={total === 0 ? "text-amber-600" : "text-slate-700"}>{total} orang</span>
                    <span className="ml-1.5 text-xs text-slate-400">
                      (S1: {staffing.SHIFT_1} · S2: {staffing.SHIFT_2} · Full: {staffing.FULLSHIFT})
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={o.status === "ACTIVE" ? "success" : "neutral"}>{o.status}</Badge>
                  </Td>
                  <Td>
                    <Link href={`/admin/outlets/${o.id}/targets`} className="text-sm font-medium text-accent-700 hover:text-accent-800">
                      Target Bulanan
                    </Link>
                  </Td>
                </Tr>
              );
            })}
            {outlets.length === 0 && <EmptyRow colSpan={7}>Belum ada outlet.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
