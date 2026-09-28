import { redirect } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  LayoutGrid,
  History,
  FileText,
  Package,
  ClipboardList,
  ShieldCheck,
  CheckSquare,
  Archive,
  FileCheck2,
  CalendarOff,
  Clock,
  MapPin,
  NotebookPen,
  PieChart,
  Store,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type MenuLink = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

type MenuGroup = {
  title: string;
  accent: "blue" | "emerald" | "amber" | "violet" | "rose";
  items: MenuLink[];
};

const ACCENT_CLASSES: Record<MenuGroup["accent"], { bar: string; icon: string; ring: string }> = {
  blue: { bar: "bg-sky-500", icon: "bg-sky-50 text-sky-700", ring: "hover:ring-sky-200" },
  emerald: { bar: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-700", ring: "hover:ring-emerald-200" },
  amber: { bar: "bg-amber-500", icon: "bg-amber-50 text-amber-700", ring: "hover:ring-amber-200" },
  violet: { bar: "bg-violet-500", icon: "bg-violet-50 text-violet-700", ring: "hover:ring-violet-200" },
  rose: { bar: "bg-rose-500", icon: "bg-rose-50 text-rose-700", ring: "hover:ring-rose-200" },
};

const MENU_GROUPS: MenuGroup[] = [
  {
    title: "1. Dashboard",
    accent: "blue",
    items: [
      { href: "/executive", label: "Dashboard Sales", description: "Omset, channel, dan pace real-time seluruh outlet di wilayah Anda.", icon: TrendingUp },
      { href: "/wilayah", label: "Semua Menu Supervisor", description: "Halaman ini — akses cepat ke seluruh menu wilayah.", icon: LayoutGrid },
    ],
  },
  {
    title: "2. Menu Wilayah",
    accent: "emerald",
    items: [
      { href: "/transactions", label: "Riwayat Transaksi Outlet", description: "Riwayat penjualan per outlet, disummarykan per wilayah.", icon: History },
      { href: "/reports", label: "Riwayat Summary Laporan Harian", description: "Laporan setoran harian setiap outlet di wilayah Anda.", icon: FileText },
      { href: "/inventory", label: "Riwayat Summary Sisa Stock", description: "Sisa stok freezer & JPD per outlet, disummarykan per wilayah.", icon: Package },
      { href: "/purchase-orders", label: "Purchase Order Outlet", description: "Pengajuan Purchase Order dari outlet-outlet di wilayah Anda.", icon: ClipboardList },
      { href: "/report-compliance", label: "Kepatuhan Laporan", description: "Outlet mana yang tepat waktu, telat, atau belum lapor.", icon: ShieldCheck },
    ],
  },
  {
    title: "3. Verifikasi Wilayah",
    accent: "amber",
    items: [
      { href: "/validations#laporan", label: "Verifikasi Laporan", description: "Setujui atau tolak laporan harian yang menunggu.", icon: CheckSquare },
      { href: "/report-history", label: "Histori Laporan Terverifikasi", description: "Arsip laporan yang sudah Anda verifikasi.", icon: Archive },
      { href: "/purchase-orders/verify", label: "Verifikasi PO", description: "Setujui atau tolak Purchase Order yang diajukan outlet.", icon: FileCheck2 },
      { href: "/purchase-orders/history", label: "Histori PO", description: "Arsip Purchase Order yang sudah diproses.", icon: History },
      { href: "/validations#izin", label: "Persetujuan Izin", description: "Setujui pengajuan izin, sakit, libur & cuti tim Anda.", icon: CalendarOff },
    ],
  },
  {
    title: "4. Presensi SPV Wilayah",
    accent: "violet",
    items: [
      { href: "/attendance", label: "Absen Masuk & Pulang", description: "Presensi harian Anda sendiri sebagai Supervisor.", icon: Clock },
      { href: "/outlet-visits", label: "Absen Kunjungan Outlet", description: "Check-in kunjungan ke outlet di wilayah Anda.", icon: MapPin },
      { href: "/outlet-visits/report", label: "Report Kunjungan Outlet", description: "Catatan hasil setiap kunjungan outlet.", icon: NotebookPen },
      { href: "/leave", label: "Pengajuan Izin, Sakit, Libur & Cuti", description: "Ajukan izin, sakit, libur, atau cuti Anda sendiri.", icon: CalendarOff },
    ],
  },
  {
    title: "5. Ringkasan Wilayah",
    accent: "rose",
    items: [
      { href: "/region-summary", label: "Ringkasan", description: "Achievement wilayah terhadap target — per outlet & keseluruhan.", icon: PieChart },
    ],
  },
];

export default async function WilayahHubPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "SPV") redirect("/dashboard");

  const regions = await prisma.region.findMany({
    where: { spvId: user.id },
    include: { outlets: { select: { id: true, name: true } } },
  });
  const outletIds = regions.flatMap((r) => r.outlets.map((o) => o.id));
  const regionNames = regions.map((r) => r.name).join(", ") || "-";

  const [pendingReports, pendingLeave, todayOmsetAgg] = await Promise.all([
    prisma.dailyReport.count({ where: { status: "PENDING", outletId: { in: outletIds } } }),
    prisma.leavePermission.count({ where: { status: "PENDING", user: { outletId: { in: outletIds } } } }),
    prisma.transaction.aggregate({
      where: { status: "COMPLETED", outletId: { in: outletIds }, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      _sum: { total: true },
    }),
  ]);
  const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Semua Menu Supervisor"
        description={`Wilayah: ${regionNames} · ${outletIds.length} outlet aktif — akses cepat ke seluruh menu wilayah Anda.`}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Outlet di Wilayah" value={String(outletIds.length)} tone="brand" icon={<Store className="h-4 w-4" />} />
        <StatCard label="Omset Hari Ini" value={currency.format(Number(todayOmsetAgg._sum.total ?? 0))} tone="accent" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard
          label="Laporan Menunggu Verifikasi"
          value={String(pendingReports)}
          tone={pendingReports > 0 ? "warning" : "success"}
          icon={<CheckSquare className="h-4 w-4" />}
        />
        <StatCard
          label="Izin Menunggu Persetujuan"
          value={String(pendingLeave)}
          tone={pendingLeave > 0 ? "warning" : "success"}
          icon={<CalendarOff className="h-4 w-4" />}
        />
      </div>

      {MENU_GROUPS.map((group) => {
        const accent = ACCENT_CLASSES[group.accent];
        return (
          <div key={group.title}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-900">
              <span className={cn("h-4 w-1.5 rounded-full", accent.bar)} />
              {group.title}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Card
                      className={cn(
                        "h-full p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] hover:ring-2",
                        accent.ring,
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", accent.icon)}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">{item.label}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
