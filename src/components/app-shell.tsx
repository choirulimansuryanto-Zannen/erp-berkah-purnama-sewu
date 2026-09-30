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

        <main className="relative flex-1 p-4 sm:p-6" style={{ background: "var(--background-mesh)" }}>
          {/* Same decorative language as the login page's dark hero panel —
              soft blurred color orbs (now full brand-strength, not a
              barely-there hint) drifting gently over a warm/cool gradient
              mesh, plus a faint dot-grid for texture — carried in front of
              a flat fill so the interior finally reads as one piece with
              the outside login screen instead of a plain grey box behind
              it. `fixed` (not `absolute`) so it's one ambient backdrop
              anchored to the viewport, not tied to (and buried inside)
              whichever report page happens to be very tall; every Card
              stays opaque white on top, so legibility is untouched. */}
          <div
            className="pointer-events-none fixed inset-0 z-0 opacity-[0.05]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, #101f3a 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
            aria-hidden
          />
          <div
            className="animate-float pointer-events-none fixed -right-40 -top-40 z-0 h-[34rem] w-[34rem] rounded-full bg-accent-400/25 blur-3xl"
            aria-hidden
          />
          <div
            className="animate-float pointer-events-none fixed -left-32 top-1/3 z-0 h-[30rem] w-[30rem] rounded-full bg-gold-400/20 blur-3xl"
            style={{ animationDelay: "-2s" }}
            aria-hidden
          />
          <div
            className="animate-float pointer-events-none fixed bottom-[-10rem] right-1/4 z-0 h-[32rem] w-[32rem] rounded-full bg-brand-400/20 blur-3xl"
            style={{ animationDelay: "-4s" }}
            aria-hidden
          />
          <div
            className="animate-float pointer-events-none fixed left-1/2 top-10 z-0 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl"
            style={{ animationDelay: "-1s" }}
            aria-hidden
          />

          <div key={pathname} className="relative z-10 mx-auto max-w-6xl animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
