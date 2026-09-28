import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { CreateToppingForm } from "@/components/admin/create-topping-form";
import { ToppingRow } from "@/components/admin/topping-row";

export default async function AdminToppingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const toppings = await prisma.topping.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Toppings" description="Kelola extra/topping yang bisa ditambahkan pramuniaga di POS." />

      <CreateToppingForm />

      <Card>
        <CardHeader>
          <CardTitle>Semua Topping ({toppings.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th>Harga</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {toppings.map((t) => (
              <ToppingRow key={t.id} id={t.id} name={t.name} price={Number(t.price)} status={t.status} />
            ))}
            {toppings.length === 0 && <EmptyRow colSpan={4}>Belum ada topping.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
