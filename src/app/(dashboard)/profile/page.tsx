import { Mail, Shield, Store, CalendarDays } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Profil Saya" description="Kelola informasi akun dan keamanan login Anda." />

      <Card className="flex flex-wrap items-center gap-5 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 text-xl font-semibold text-accent-800">
          {initials(user.name)}
        </div>
        <div className="flex-1">
          <p className="text-lg font-semibold text-brand-900">{user.name}</p>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {user.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> {user.role.replace(/_/g, " ")}
            </span>
            {user.outlet && (
              <span className="flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5" /> {user.outlet.name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Bergabung {user.createdAt.toLocaleDateString("id-ID")}
            </span>
          </div>
        </div>
      </Card>

      <EditProfileForm initialName={user.name} initialPhone={user.phone ?? ""} />
      <ChangePasswordForm />
    </div>
  );
}
