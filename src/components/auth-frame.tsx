import Link from "next/link";
import type { ReactNode } from "react";

export function AuthFrame({
  children,
  footer,
  subtitle,
  title,
}: {
  children: ReactNode;
  footer: {
    href: string;
    label: string;
    text: string;
  };
  subtitle: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-lilac-50 px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lilac-500 text-xl font-black text-white shadow-soft">
            수
          </div>
          <div>
            <p className="text-sm font-black text-lilac-700">수학같이할래?</p>
            <p className="text-sm font-semibold text-slate-500">
              나에게 꼭 맞는 수학 공부
            </p>
          </div>
        </div>
        <section className="card p-7 sm:p-8">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
          {children}
        </section>
        <p className="mt-6 text-center text-sm text-slate-500">
          {footer.text}{" "}
          <Link className="font-bold text-lilac-700" href={footer.href}>
            {footer.label}
          </Link>
        </p>
      </div>
    </main>
  );
}
