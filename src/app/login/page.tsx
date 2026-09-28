"use client";

import { useActionState, useRef } from "react";
import { Users } from "lucide-react";
import { login, type LoginState } from "./actions";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo-accounts";
import { BpsLogo } from "@/components/ui/logo";

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

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fillDemo(email: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
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

          {process.env.NODE_ENV !== "production" && (
            <div className="mt-8 border-t border-slate-200 pt-5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Users className="h-3.5 w-3.5" />
                Demo Accounts (dev only) — klik untuk isi otomatis
              </p>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {DEMO_USERS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemo(account.email)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-slate-600 transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-800"
                  >
                    {ROLE_LABEL[account.role] ?? account.role}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
