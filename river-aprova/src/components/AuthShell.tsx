import type { ReactNode } from "react";
import Logo from "./Logo";

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Logo className="mb-8 text-3xl" />
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-navy/5 sm:p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-navy/60">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function Feedback({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  const style = kind === "error" ? "bg-red-50 text-red-700" : "bg-sky-soft text-navy";
  return <p role="alert" className={`rounded-lg px-3 py-2 text-sm ${style}`}>{children}</p>;
}
