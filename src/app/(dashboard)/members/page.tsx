import { Award } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { RegisterMemberForm } from "@/components/members/register-member-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";

const TIER_TONE = { BRONZE: "neutral", SILVER: "info", GOLD: "warning" } as const;

export default async function MembersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const members = await prisma.member.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const tierCounts = { BRONZE: 0, SILVER: 0, GOLD: 0 } as Record<string, number>;
  members.forEach((m) => (tierCounts[m.tier] = (tierCounts[m.tier] ?? 0) + 1));

  return (
    <div className="space-y-6">
      <PageHeader title="Members" description="Loyalty program dan distribusi tier member." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(["BRONZE", "SILVER", "GOLD"] as const).map((tier) => (
          <StatCard
            key={tier}
            label={tier}
            value={String(tierCounts[tier] ?? 0)}
            tone={TIER_TONE[tier]}
            icon={<Award className="h-4 w-4" />}
          />
        ))}
      </div>

      {can(user.role, "member:register") && <RegisterMemberForm />}

      <Card>
        <CardHeader>
          <CardTitle>Member Terbaru</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <tr>
              <Th>ID Member</Th>
              <Th>Nama</Th>
              <Th>No. HP</Th>
              <Th>Kota</Th>
              <Th>Tier</Th>
              <Th>Points</Th>
            </tr>
          </Thead>
          <tbody>
            {members.map((m) => (
              <Tr key={m.id}>
                <Td className="font-mono text-xs text-slate-500">{m.code ?? "-"}</Td>
                <Td className="font-medium text-slate-900">{m.name}</Td>
                <Td>{m.phone}</Td>
                <Td>{m.city ?? "-"}</Td>
                <Td>
                  <Badge tone={TIER_TONE[m.tier]}>{m.tier}</Badge>
                </Td>
                <Td>{m.pointsBalance.toLocaleString("id-ID")}</Td>
              </Tr>
            ))}
            {members.length === 0 && <EmptyRow colSpan={6}>Belum ada member.</EmptyRow>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
