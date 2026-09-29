import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { CreateOutletLedgerAccountForm } from "@/components/admin/create-outlet-ledger-account-form";
import { OutletLedgerAccountRow } from "@/components/admin/outlet-ledger-account-row";

// Master data for the Laporan Outlet Jurnal Sheet's fixed chart of accounts
// (No. Akun 1-42) — the accounts an FA/SPV picks from when logging each
// day's ledger line (Tanggal / No. Akun / Keterangan / D-C / Nilai).
export default async function AdminOutletLedgerAccountsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const [accounts, usage] = await Promise.all([
    prisma.outletLedgerAccount.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outletLedgerEntry.findMany({ distinct: ["accountId"], select: { accountId: true } }),
  ]);
  const usedIds = new Set(usage.map((u) => u.accountId));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jurnal Sheet — Chart of Accounts"
        description="Kelola daftar No. Akun tetap yang dipakai saat mencatat Jurnal Sheet Laporan Outlet (Tanggal / No. Akun / Keterangan / D-C / Nilai)."
      />

      <CreateOutletLedgerAccountForm />

      <Card>
        <CardHeader>
          <CardTitle>Semua Akun ({accounts.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>No. Akun</Th>
              <Th>Nama Akun</Th>
              <Th>Default D/C</Th>
              <Th>Urutan</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {accounts.map((a) => (
              <OutletLedgerAccountRow
                key={a.id}
                id={a.id}
                number={a.number}
                label={a.label}
                defaultSide={a.defaultSide}
                sortOrder={a.sortOrder}
                status={a.status}
                hasUsage={usedIds.has(a.id)}
              />
            ))}
            {accounts.length === 0 && <EmptyRow colSpan={6}>Belum ada akun.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
