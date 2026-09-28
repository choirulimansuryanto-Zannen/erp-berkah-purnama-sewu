"use client";

import { useActionState, useRef, useState } from "react";
import {
  KeyRound,
  ShoppingBag,
  ShieldCheck,
  Building2,
  Package,
  Calculator,
  UsersRound,
  Megaphone,
  Crown,
  Check,
} from "lucide-react";
import { login, type LoginState } from "./actions";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo-accounts";
import { BpsLogo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const initialState: LoginState = { error: null };

const ROLE_LABEL: Record<string, string> = {
  PRAMUNIAGA: "Pramuniaga",
  SPV: "SPV",
  OFFICE: "Office",
  OPS_ADMIN: "Ops Admin",
  FA_ADMIN: "FA Admin",
  HRGA_ADMIN: "HRGA Admin",
  MARKETING_ADMIN: "Marketing Admin",
  MASTER_ADMIN: "Master Admin",
};

const ROLE_ICON: Record<string, typeof KeyRound> = {
  PRAMUNIAGA: ShoppingBag,
  SPV: ShieldCheck,
  OFFICE: Building2,
  OPS_ADMIN: Package,
  FA_ADMIN: Calculator,
  HRGA_ADMIN: UsersRound,
  MARKETING_ADMIN: Megaphone,
  MASTER_ADMIN: Crown,
};

// Two natural clusters — front-of-house (outlet floor) vs. back-of-house
// (head office) — rather than one flat grid of eight identical tiles.
const ROLE_GROUPS: { label: string; roles: string[] }[] = [
  { label: "Outlet & Wilayah", roles: ["PRAMUNIAGA", "SPV"] },
  { label: "Kantor Pusat", roles: ["OFFICE", "OPS_ADMIN", "FA_ADMIN", "HRGA_ADMIN", "MARKETING_ADMIN", "MASTER_ADMIN"] },
];

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  function fillDemo(email: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
    setSelectedEmail(email);
    emailRef.current?.focus();
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-950 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="animate-float pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold-400/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-accent-500/20 blur-3xl"
          aria-hidden
        />

        <div className="animate-fade-in-up relative flex items-center gap-3">
          <BpsLogo size={44} animated />
          <span className="text-sm font-semibold tracking-wide text-white/90">
            BERKAH PURNAMA SEWU
          </span>
        </div>

        <div className="animate-fade-in-up relative max-w-md" style={{ animationDelay: "0.1s" }}>
          <div className="mb-5 h-1 w-14 rounded-full bg-gold-400" />
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Satu sistem, seluruh operasional bisnis Anda.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Visibilitas real-time untuk penjualan, kehadiran, inventori, dan keuangan
            di seluruh outlet — dari pramuniaga hingga eksekutif.
          </p>
        </div>

        <p className="relative text-xs text-white/40">
          &copy; {new Date().getFullYear()} PT Berkah Purnama Sewu. Internal use only.
        </p>
      </div>

      <div className="flex items-center justify-center bg-slate-50 px-6 py-12 lg:bg-white">
        <div className="animate-fade-in-up w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BpsLogo size={38} animated />
            <span className="text-sm font-semibold tracking-wide text-brand-900">
              BERKAH PURNAMA SEWU
            </span>
          </div>

          <h2 className="text-xl font-semibold text-brand-900">Masuk ke akun Anda</h2>
          <p className="mt-1 text-sm text-slate-500">Gunakan kredensial yang diberikan oleh admin.</p>

          <form action={formAction} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-600">
                Email
              </label>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="field-glow mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-accent-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-600">
                Password
              </label>
              <input
                ref={passwordRef}
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="field-glow mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-accent-500 focus:outline-none"
              />
            </div>

            {state.error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="sheen w-full rounded-lg bg-accent-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-accent-700 hover:shadow-lg hover:shadow-accent-600/25 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {pending ? "Memproses..." : "Masuk"}
            </button>
          </form>

          {/* Demo accounts intentionally shown regardless of environment —
              this deployment itself is a demo/staging site (no real
              customer-facing production instance exists yet), so gating on
              NODE_ENV hid it everywhere it was actually needed. */}
          <div className="animate-fade-in-up relative mt-9 overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 p-[1px] shadow-lg shadow-navy-950/20" style={{ animationDelay: "0.15s" }}>
              {/* Gold hairline frame — the "letter-box" premium touch, same
                  language as the logo's gold ring. */}
              <div className="rounded-[15px] bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-5">
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-400/10 blur-3xl"
                  aria-hidden
                />
                <div className="relative flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-400/15 ring-1 ring-inset ring-gold-400/30">
                    <KeyRound className="h-4 w-4 text-gold-400" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gold-400">Demo Accounts</p>
                    <p className="text-[11px] text-white/45">Khusus development — klik untuk isi otomatis</p>
                  </div>
                </div>

                <div className="relative mt-4 space-y-4">
                  {ROLE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                        <span className="h-px flex-1 bg-white/10" />
                        {group.label}
                        <span className="h-px flex-1 bg-white/10" />
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {DEMO_USERS.filter((a) => group.roles.includes(a.role)).map((account) => {
                          const Icon = ROLE_ICON[account.role] ?? KeyRound;
                          const isSelected = selectedEmail === account.email;
                          return (
                            <button
                              key={account.email}
                              type="button"
                              onClick={() => fillDemo(account.email)}
                              className={cn(
                                "group relative flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                                isSelected
                                  ? "sheen-gold bg-gradient-to-br from-gold-400 to-gold-600 shadow-md shadow-gold-500/25"
                                  : "bg-white/[0.06] ring-1 ring-inset ring-white/10 hover:-translate-y-0.5 hover:bg-white/[0.1] hover:ring-gold-400/40",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                                  isSelected ? "bg-navy-950/15 text-navy-950" : "bg-white/10 text-gold-400 group-hover:bg-gold-400/15",
                                )}
                              >
                                {isSelected ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                              </span>
                              <span
                                className={cn(
                                  "truncate text-xs font-semibold",
                                  isSelected ? "text-navy-950" : "text-white/85",
                                )}
                              >
                                {ROLE_LABEL[account.role] ?? account.role}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
