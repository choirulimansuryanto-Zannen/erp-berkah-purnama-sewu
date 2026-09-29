import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { CreateExpenseCategoryForm } from "@/components/admin/create-expense-category-form";
import { ExpenseCategoryRow } from "@/components/admin/expense-category-row";

export default async function AdminExpenseCategoriesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const categories = await prisma.expenseCategoryDef.findMany({ orderBy: { sortOrder: "asc" } });
  const usedKeys = new Set(
    (await prisma.expenseRecord.findMany({ distinct: ["category"], select: { category: true } })).map((e) => e.category),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategori Pengeluaran"
        description="Kelola akun/kategori yang muncul di menu Expenses > Pengeluaran Operasional Outlet."
      />

      <CreateExpenseCategoryForm />

      <Card>
        <CardHeader>
          <CardTitle>Semua Kategori ({categories.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Key</Th>
              <Th>Label</Th>
              <Th>Urutan</Th>
              <Th>Status</Th>
              <Th>Kelompok (Jurnal Sheet)</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {categories.map((c) => (
              <ExpenseCategoryRow
                key={c.id}
                id={c.id}
                keyName={c.key}
                label={c.label}
                sortOrder={c.sortOrder}
                status={c.status}
                overheadGroup={c.overheadGroup}
                hasUsage={usedKeys.has(c.key)}
              />
            ))}
            {categories.length === 0 && <EmptyRow colSpan={6}>Belum ada kategori.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
