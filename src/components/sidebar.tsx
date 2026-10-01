"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  LayoutDashboard,
  ChevronDown,
  ShoppingCart,
  Clock,
  ClipboardCheck,
  FileText,
  Receipt,
  CheckSquare,
  Package,
  Warehouse,
  Users,
  Megaphone,
  UsersRound,
  Wallet,
  UserCog,
  Settings,
  BarChart3,
  CalendarOff,
  Store,
  Tag,
  History,
  Sparkles,
  UserCheck,
  Split,
  Ticket,
  Snowflake,
  TrendingUp,
  LayoutGrid,
  ClipboardList,
  ShieldCheck,
  Archive,
  MapPin,
  NotebookPen,
  PieChart,
  FileCheck2,
  Calculator,
  Banknote,
  Table2,
  Factory,
  Scale,
  Boxes,
  GitCompareArrows,
  HandCoins,
  Columns3,
  Percent,
  Layers,
} from "lucide-react";
import { can, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission | Permission[];
  // Sub-pages nested under this item, collapsed by default and revealed on
  // click — used for FA Company's 7 report pages so the sidebar doesn't
  // show all of them at once (stakeholder feedback: too long).
  children?: NavItem[];
};

type NavSection = {
  label: string;
  items: NavItem[];
  // Hides the whole section for these roles regardless of the individual
  // items' own permissions — for a section that's structurally irrelevant
  // to a role even though some items in it are unguarded or the role
  // happens to hold one of an item's permissions for unrelated reasons
  // (e.g. FA_ADMIN can validate reports/approve expenses, but "Operations"
  // as a menu is still noise for a pure finance role).
  hiddenForRoles?: Role[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/executive", label: "Executive", icon: BarChart3, permission: "executive:view_dashboard" },
    ],
  },
  {
    label: "Operations",
    hiddenForRoles: ["FA_ADMIN"],
    items: [
      { href: "/pos", label: "POS / Kasir", icon: ShoppingCart, permission: "pos:ring_up" },
      { href: "/attendance", label: "Attendance", icon: Clock },
      { href: "/reports", label: "Daily Reports", icon: FileText },
      { href: "/transactions", label: "Riwayat Transaksi", icon: History, permission: "transactions:view_history" },
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/warehouse", label: "Warehouse", icon: Warehouse, permission: "warehouse:manage" },
      {
        href: "/validations",
        label: "Validations",
        icon: CheckSquare,
        permission: ["report:validate", "expense:approve", "inventory:approve_adjustment", "attendance:approve_leave"],
      },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/members", label: "Members", icon: Users, permission: "member:view" },
      { href: "/marketing", label: "Marketing", icon: Megaphone, permission: "marketing:manage_campaigns" },
    ],
  },
  {
    label: "People & Finance",
    items: [
      { href: "/hrga", label: "HRGA", icon: UsersRound, permission: "hrga:manage_policy" },
      {
        href: "/finance",
        label: "FA Company",
        icon: Wallet,
        permission: "finance:view_ledger",
        children: [
          { href: "/finance/journal", label: "Jurnal (6 Buku Kas)", icon: Receipt, permission: "finance:view_ledger" },
          { href: "/finance/ledger", label: "Buku Besar", icon: History, permission: "finance:view_ledger" },
          { href: "/finance/adjusting-entries", label: "Jurnal Penyesuaian", icon: NotebookPen, permission: "finance:view_ledger" },
          { href: "/finance/worksheet", label: "Worksheet (Neraca Lajur)", icon: Table2, permission: "finance:view_ledger" },
          { href: "/finance/persediaan", label: "Persediaan", icon: Boxes, permission: "finance:view_ledger" },
          { href: "/finance/hpp", label: "Laporan HPP", icon: Factory, permission: "finance:view_ledger" },
          { href: "/finance/reports", label: "Laba Rugi", icon: FileCheck2, permission: "finance:view_ledger" },
          { href: "/finance/equity-changes", label: "Perubahan Ekuitas", icon: PieChart, permission: "finance:view_ledger" },
          { href: "/finance/neraca", label: "Neraca", icon: Scale, permission: "finance:view_ledger" },
          { href: "/finance/cash-flow", label: "Laporan Arus Kas", icon: Banknote, permission: "finance:view_ledger" },
          { href: "/finance/perbandingan-tahunan", label: "Perbandingan Tahunan", icon: GitCompareArrows, permission: "finance:view_ledger" },
          { href: "/finance/insights", label: "Analisis & Insight", icon: Sparkles, permission: "finance:view_ledger" },
        ],
      },
      {
        href: "/finance/outlet",
        label: "FA Outlet",
        icon: Store,
        permission: "finance:view_ledger",
        children: [
          { href: "/finance/kasbon", label: "Kasbon Pramuniaga", icon: HandCoins, permission: "finance:view_ledger" },
          { href: "/finance/outlet", label: "Laporan Outlet", icon: FileText, permission: "finance:view_ledger" },
          { href: "/finance/insentif", label: "Laporan Insentif", icon: Percent, permission: "finance:view_ledger" },
          { href: "/finance/sharing-profit", label: "Laporan Sharing Profit", icon: HandCoins, permission: "finance:view_ledger" },
          { href: "/finance/pembanding-outlet", label: "Laporan Pembanding Outlet", icon: Columns3, permission: "finance:view_ledger" },
        ],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/users", label: "Users", icon: UserCog, permission: "admin:manage_users" },
      { href: "/admin/outlets", label: "Outlets", icon: Store, permission: "admin:system_config" },
      { href: "/admin/products", label: "Products", icon: Tag, permission: "admin:system_config" },
      { href: "/admin/toppings", label: "Toppings", icon: Sparkles, permission: "admin:system_config" },
      { href: "/admin/channel-rules", label: "Aturan Channel", icon: Split, permission: "admin:system_config" },
      { href: "/admin/vouchers", label: "Vouchers", icon: Ticket, permission: "admin:system_config" },
      { href: "/admin/package-composition", label: "Isi Paket", icon: Package, permission: "admin:system_config" },
      { href: "/admin/expense-categories", label: "Kategori Pengeluaran", icon: Receipt, permission: "admin:system_config" },
      { href: "/admin/chart-of-accounts", label: "Chart of Accounts", icon: Calculator, permission: "admin:system_config" },
      { href: "/admin/incentive-rules", label: "Rate Insentif", icon: Percent, permission: "finance:manage_incentive_rules" },
      { href: "/admin/investors", label: "Investor & Sharing Profit", icon: HandCoins, permission: "finance:manage_incentive_rules" },
      { href: "/admin/pramuniaga-roster", label: "Roster Pramuniaga", icon: UserCheck, permission: "admin:system_config" },
      { href: "/admin/freezer-materials", label: "Bahan Baku Freezer", icon: Snowflake, permission: "admin:system_config" },
      { href: "/admin/outlet-materials", label: "Data Stock Available", icon: Boxes, permission: "admin:system_config" },
      { href: "/admin/outlet-ledger-accounts", label: "Jurnal Sheet — Chart of Accounts", icon: Table2, permission: "admin:system_config" },
      { href: "/admin/incentive-brackets", label: "Bracket Insentif Outlet", icon: Layers, permission: "finance:manage_incentive_rules" },
      { href: "/admin/settings", label: "System Settings", icon: Settings, permission: "admin:system_config" },
    ],
  },
];

// Pramuniaga has its own, explicitly-ordered menu (per stakeholder request)
// rather than the permission-filtered NAV_SECTIONS every other role shares —
// their day revolves around a specific sequence (check in, ring up sales,
// report) that doesn't map cleanly onto the admin-oriented section grouping.
const PRAMUNIAGA_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/attendance", label: "Presensi Checklist Outlet", icon: ClipboardCheck },
  { href: "/pos", label: "POS / Kasir", icon: ShoppingCart },
  { href: "/transactions", label: "Riwayat Transaksi", icon: History },
  { href: "/setoran", label: "Laporan Harian", icon: Wallet },
  { href: "/inventory", label: "Stock Freezer & JPD", icon: Package },
  { href: "/outlet-summary", label: "Ringkasan Outlet", icon: TrendingUp },
  { href: "/leave", label: "Izin, Sakit & Libur", icon: CalendarOff },
  { href: "/members", label: "Pelanggan & Member", icon: Users },
];

// SPV's own dedicated menu (per stakeholder spec) — 5 groups matching
// Dashboard / Menu Wilayah / Verifikasi Wilayah / Presensi SPV Wilayah /
// Ringkasan Wilayah exactly, instead of the shared permission-filtered
// NAV_SECTIONS every other management role uses. Most destinations reuse
// existing region-scoped pages (getScopedOutletIds already narrows them to
// this SPV's own region) — a few are net-new subsystems (Purchase Order,
// Kunjungan Outlet) still being built out.
const SPV_NAV_SECTIONS: NavSection[] = [
  {
    label: "1. Dashboard",
    items: [
      { href: "/executive", label: "Dashboard Sales", icon: TrendingUp },
      { href: "/wilayah", label: "Semua Menu Supervisor", icon: LayoutGrid },
    ],
  },
  {
    label: "2. Menu Wilayah",
    items: [
      { href: "/transactions", label: "Riwayat Transaksi Outlet", icon: History },
      { href: "/reports", label: "Riwayat Summary Laporan Harian", icon: FileText },
      { href: "/inventory", label: "Riwayat Summary Sisa Stock", icon: Package },
      { href: "/purchase-orders", label: "Purchase Order Outlet", icon: ClipboardList },
      { href: "/report-compliance", label: "Kepatuhan Laporan", icon: ShieldCheck },
    ],
  },
  {
    label: "3. Verifikasi Wilayah",
    items: [
      { href: "/validations#laporan", label: "Verifikasi Laporan", icon: CheckSquare },
      { href: "/report-history", label: "Histori Laporan Terverifikasi", icon: Archive },
      { href: "/purchase-orders/verify", label: "Verifikasi PO", icon: FileCheck2 },
      { href: "/purchase-orders/history", label: "Histori PO", icon: History },
      { href: "/validations#izin", label: "Persetujuan Izin", icon: CalendarOff },
    ],
  },
  {
    label: "4. Presensi SPV Wilayah",
    items: [
      { href: "/attendance", label: "Absen Masuk & Pulang", icon: Clock },
      { href: "/outlet-visits", label: "Absen Kunjungan Outlet", icon: MapPin },
      { href: "/outlet-visits/report", label: "Report Kunjungan Outlet", icon: NotebookPen },
      { href: "/leave", label: "Pengajuan Izin, Sakit, Libur & Cuti", icon: CalendarOff },
    ],
  },
  {
    label: "5. Ringkasan Wilayah",
    items: [{ href: "/region-summary", label: "Ringkasan", icon: PieChart }],
  },
];

function hasAccess(role: Role, permission?: Permission | Permission[]): boolean {
  if (!permission) return true;
  const permissions = Array.isArray(permission) ? permission : [permission];
  return permissions.some((p) => can(role, p));
}

/** Applies permission filtering to an item and, recursively, its children —
 * a parent with children that all get filtered out still renders (it may
 * have its own destination page), just with an empty children array. */
function filterItem(item: NavItem, role: Role): NavItem | null {
  if (!hasAccess(role, item.permission)) return null;
  if (!item.children) return item;
  const children = item.children.filter((c) => hasAccess(role, c.permission));
  return { ...item, children };
}

function pathMatches(pathname: string | null, href: string): boolean {
  const itemPath = href.split("#")[0];
  return pathname === itemPath || (pathname?.startsWith(`${itemPath}/`) ?? false);
}

export function Sidebar({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections: NavSection[] =
    role === "PRAMUNIAGA"
      ? [{ label: "Menu", items: PRAMUNIAGA_NAV }]
      : role === "SPV"
        ? SPV_NAV_SECTIONS
        : NAV_SECTIONS.filter((section) => !section.hiddenForRoles?.includes(role))
            .map((section) => ({
              ...section,
              items: section.items.map((item) => filterItem(item, role)).filter((item): item is NavItem => item !== null),
            }))
            .filter((section) => section.items.length > 0);

  // Sub-pages (e.g. FA Company's 7 report pages) start collapsed and only
  // appear once their parent is clicked — auto-expanded here if the page
  // currently open is one of them, so a direct link/reload doesn't hide the
  // active page's own group.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (item.children?.some((c) => pathMatches(pathname, c.href))) initial[item.href] = true;
      }
    }
    return initial;
  });

  return (
    <nav className="flex h-full w-64 flex-col gap-4 overflow-y-auto border-r border-slate-200/70 bg-white px-3 py-4">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {section.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = pathMatches(pathname, item.href);
              const hasChildren = !!item.children?.length;
              const childActive = hasChildren && item.children!.some((c) => pathMatches(pathname, c.href));
              const isOpen = hasChildren && (expanded[item.href] ?? false);
              const Icon = item.icon;
              return (
                <div key={item.href}>
                  <div className="flex items-center gap-0.5">
                    <Link
                      href={item.href}
                      onClick={() => {
                        onNavigate?.();
                        if (hasChildren) setExpanded((prev) => ({ ...prev, [item.href]: true }));
                      }}
                      className={cn(
                        "flex flex-1 items-center gap-3 rounded-lg border-l-[3px] py-2 pr-2 text-sm font-medium transition-all duration-150",
                        active || childActive
                          ? "border-gold-400 bg-accent-50 pl-[9px] text-accent-800"
                          : "border-transparent pl-3 text-slate-600 hover:translate-x-0.5 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", active || childActive ? "text-accent-600" : "text-slate-400")} />
                      {item.label}
                    </Link>
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [item.href]: !prev[item.href] }))}
                        aria-label={isOpen ? `Tutup ${item.label}` : `Buka ${item.label}`}
                        aria-expanded={isOpen}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-150", isOpen && "rotate-180")} />
                      </button>
                    )}
                  </div>
                  {hasChildren && isOpen && (
                    <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 pl-2">
                      {item.children!.map((child) => {
                        const childActiveItem = pathMatches(pathname, child.href);
                        const ChildIcon = child.icon;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg py-1.5 pl-2 pr-3 text-[13px] font-medium transition-all duration-150",
                              childActiveItem
                                ? "bg-accent-50 text-accent-800"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                            )}
                          >
                            <ChildIcon className={cn("h-4 w-4 shrink-0", childActiveItem ? "text-accent-600" : "text-slate-400")} />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
