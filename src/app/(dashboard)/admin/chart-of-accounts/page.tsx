import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { CreateCoaForm } from "@/components/admin/create-coa-form";
import { CoaRow } from "@/components/admin/coa-row";
import { ACCOUNT_TYPE_LABELS } from "@/lib/accounting";
import type { AccountType } from "@prisma/client";

// Depth-first walk so every child renders directly under its parent,
// indented — matches how a chart of accounts is actually read, not a flat
// alphabetical list.
function orderByHierarchy<T extends { id: string; parentId: string | null }>(accounts: T[]): (T & { depth: number })[] {
  const byParent = new Map<string | null, T[]>();
  for (const a of accounts) {
    const list = byParent.get(a.parentId) ?? [];
    list.push(a);
    byParent.set(a.parentId, list);
  }
  const result: (T & { depth: number })[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const a of byParent.get(parentId) ?? []) {
      result.push({ ...a, depth });
      walk(a.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

export default async function ChartOfAccountsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const accounts = await prisma.chartOfAccount.findMany({ orderBy: { code: "asc" } });
  const nameByParentId = new Map(accounts.map((a) => [a.id, `${a.code} ${a.name}`]));

  const byType = new Map<AccountType, typeof accounts>();
  for (const a of accounts) {
    const list = byType.get(a.type) ?? [];
    list.push(a);
    byType.set(a.type, list);
  }

  const parentOptions = accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description={`Daftar akun untuk seluruh jurnal FA Company — ${accounts.length} akun. Enam akun buku kas (Kasir, Brankas, Kas Outlet, Petty Cash, Bank BCA, Bank Mandiri) tidak dapat dihapus.`}
      />

      <CreateCoaForm parentOptions={parentOptions} />

      {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((type) => {
        const list = byType.get(type) ?? [];
        if (list.length === 0) return null;
        const ordered = orderByHierarchy(list);
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle>
                {ACCOUNT_TYPE_LABELS[type]} <span className="font-normal text-slate-400">({list.length})</span>
              </CardTitle>
            </CardHeader>
            <Table>
              <Thead>
                <tr>
                  <Th>Kode</Th>
                  <Th>Nama Akun</Th>
                  <Th>Saldo Normal</Th>
                  <Th>Buku Kas</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <tbody>
                {ordered.map((a) => (
                  <CoaRow
                    key={a.id}
                    id={a.id}
                    code={a.code}
                    name={a.name}
                    normalBalance={a.normalBalance}
                    status={a.status}
                    cashBook={a.cashBook}
                    parentLabel={a.parentId ? (nameByParentId.get(a.parentId) ?? null) : null}
                    depth={a.depth}
                  />
                ))}
                {ordered.length === 0 && <EmptyRow colSpan={6}>Belum ada akun.</EmptyRow>}
              </tbody>
            </Table>
          </Card>
        );
      })}
    </div>
  );
}
