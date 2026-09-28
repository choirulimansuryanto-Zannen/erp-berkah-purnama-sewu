import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { NotificationBell } from "@/components/notification-bell";
import { formatParticipantNames } from "@/lib/attendance-participants";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const notifications = await getNotifications(user.role);

  // Once checked in, the header should reflect who's actually on shift right
  // now (the roster name(s) + shift declared at check-in), not the login
  // account's own name or its static default shift assignment. Before
  // check-in, fall back to those defaults since there's no session yet. Each
  // pramuniaga checks in independently now, so there may be several open
  // rows at once — combined here for a compact header, fully separated on
  // Laporan Harian where it actually matters.
  const openSessions =
    user.role === "PRAMUNIAGA"
      ? await prisma.attendanceRecord.findMany({
          where: { userId: user.id, timeOut: null },
          include: { pramuniagaRoster: true },
          orderBy: { timeIn: "asc" },
        })
      : [];
  const openSessionNames = openSessions.map((s) => s.pramuniagaRoster?.name).filter((n): n is string => Boolean(n));

  return (
    <AppShell
      role={user.role}
      userName={openSessionNames.length > 0 ? formatParticipantNames(openSessionNames) : user.name}
      outletName={user.outlet?.name}
      shiftLabel={openSessions[0]?.shift ?? (user.role === "PRAMUNIAGA" ? user.shift : undefined)}
      notificationBell={<NotificationBell items={notifications} />}
    >
      {children}
    </AppShell>
  );
}
