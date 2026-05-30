"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";

export function AppShell({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  const router = useRouter();
  const { logout, profile } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-lilac-50/70">
      <header className="border-b border-lilac-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lilac-500 text-lg font-black text-white shadow-soft">
              수
            </div>
            <div>
              <p className="text-sm font-black text-lilac-700">
                수학같이할래?
              </p>
              <p className="text-sm font-semibold text-slate-500">
                {profile?.displayName}님, 반가워요.
              </p>
            </div>
          </div>
          <button
            className="rounded-full border border-lilac-200 bg-white px-4 py-2 text-sm font-bold text-lilac-700 transition hover:bg-lilac-50"
            onClick={handleLogout}
            type="button"
          >
            로그아웃
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="text-sm font-bold text-lilac-600">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h1>
        {children}
      </section>
    </main>
  );
}
