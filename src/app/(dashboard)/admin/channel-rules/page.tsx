import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { ChannelRulesForm } from "@/components/admin/channel-rules-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function ChannelRulesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "admin:system_config")) redirect("/dashboard");

  const rules = await prisma.categoryChannelRule.findMany();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aturan Channel Menu"
        description="Atur kategori menu mana yang boleh dijual di channel tertentu, tanpa perlu ubah kode."
      />
      <ChannelRulesForm initialRules={rules.map((r) => ({ category: r.category, allowedChannels: r.allowedChannels }))} />
    </div>
  );
}
