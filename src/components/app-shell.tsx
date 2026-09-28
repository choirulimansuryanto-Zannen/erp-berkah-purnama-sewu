"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { Menu, X, Store, Clock3 } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { BpsLogo } from "@/components/ui/logo";
import { logout } from "@/app/login/actions";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const SHIFT_LABELS: Record<string, string> = {
  SHIFT_1: "Shift 1",
  SHIFT_2: "Shift 2",
  FULLSHIFT: "Fullshift",
};

type Props = {
  role: Role;
  userName: string;
  outletName?: string;
  shiftLabel?: string;
  notificationBell: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ role, userName, outletName, shiftLabel, notificationBell, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={sidebarOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-900 text-white transition-colors hover:bg-brand-800"
          >
            {sidebarOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </button>
          <Link href="/dashboard" className="flex items-center gap-2.5 transition-transform hover:scale-[1.03] active:scale-95">
            <BpsLogo size={34} />
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-brand-900">Berkah Purnama Sewu</p>
              <p className="text-[11px] text-slate-400">Operations Platform</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {outletName && (
            <div className="hidden items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 md:flex">
              <Store className="h-3.5 w-3.5 text-slate-400" />
              {outletName}
            </div>
          )}
          {shiftLabel && (
            <div className="hidden items-center gap-1.5 rounded-lg bg-gold-50 px-3 py-1.5 text-xs font-medium text-gold-800 ring-1 ring-inset ring-gold-200 md:flex">
              <Clock3 className="h-3.5 w-3.5 text-gold-600" />
              {SHIFT_LABELS[shiftLabel] ?? shiftLabel}
            </div>
          )}

          {notificationBell}

          <Link
            href="/profile"
            className="flex items-center gap-2.5 rounded-full border border-slate-200 py-1 pl-1 pr-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-800">
              {initials(userName)}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-xs font-medium text-slate-800">{userName}</p>
              <p className="text-[11px] text-slate-400">{role.replace(/_/g, " ")}</p>
            </div>
          </Link>

          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Logout
            </button>
          </form>
        </div>
      </header>

      <div className="relative flex flex-1">
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
            className="fixed inset-x-0 bottom-0 top-16 z-20 bg-slate-900/30"
          />
        )}
        <div
          className={`fixed inset-y-0 left-0 top-16 z-30 w-64 transform shadow-xl transition-transform duration-200 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar role={role} onNavigate={() => setSidebarOpen(false)} />
        </div>

        <main className="flex-1 bg-[var(--background)] p-4 sm:p-6">
          <div key={pathname} className="mx-auto max-w-6xl animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
