import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { CreateIncentiveBracketForm } from "@/components/admin/create-incentive-bracket-form";
import { IncentiveBracketRow } from "@/components/admin/incentive-bracket-row";

// Master data for the Laporan Outlet Absen+Insentive Sheet's tiered omset
// bracket table — a day's Omset picks exactly one bracket by range, and
// that bracket's rate (1 PIC present vs +1 PIC) is applied to the day's
// Omset and split across whoever was present.
//
// The seeded rows are a best-effort reading of the source spreadsheet —
// verify the rates against real payroll figures before relying on them.
export default async function AdminIncentiveBracketsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const brackets = await prisma.incentiveBracket.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bracket Insentif Outlet"
        description="Kelola tabel tarif insentif bertingkat berdasarkan Omset harian (Absen+Insentive Sheet Laporan Outlet). Verifikasi tarif berikut terhadap data payroll asli sebelum dipakai final."
      />

      <CreateIncentiveBracketForm />

      <Card>
        <CardHeader>
          <CardTitle>Semua Bracket ({brackets.length})</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>Label</Th>
              <Th>Omset Min</Th>
              <Th>Omset Max</Th>
              <Th>Rate 1 PIC</Th>
              <Th>Rate +1 PIC</Th>
              <Th>Urutan</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <tbody>
            {brackets.map((b) => (
              <IncentiveBracketRow
                key={b.id}
                id={b.id}
                label={b.label}
                rangeMin={Number(b.rangeMin)}
                rangeMax={b.rangeMax === null ? null : Number(b.rangeMax)}
                rateSinglePic={Number(b.rateSinglePic)}
                rateMultiPic={Number(b.rateMultiPic)}
                sortOrder={b.sortOrder}
                status={b.status}
              />
            ))}
            {brackets.length === 0 && <EmptyRow colSpan={8}>Belum ada bracket.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
