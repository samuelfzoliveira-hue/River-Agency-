import Link from "next/link";
import type { ReactNode } from "react";
import type { AlertLevel } from "@/lib/domain/alerts";
import { LEVEL_LABEL } from "@/lib/domain/alerts";
import { initials } from "@/lib/data";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, hint, action, children, className = "" }: { title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card card-pad ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, href, tone }: { label: string; value: ReactNode; sub?: ReactNode; href?: string; tone?: "bad" | "warn" | "ok" }) {
  const color = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "";
  const body = (
    <div className="card card-pad h-full transition hover:border-brand/40">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Progress({ value, tone, label, thin }: { value: number; tone?: "ok" | "warn" | "bad" | "brand"; label?: string; thin?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  const bar = tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-warn" : tone === "ok" ? "bg-ok" : "bg-brand";
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className={`w-full overflow-hidden rounded-full bg-sunken ${thin ? "h-1.5" : "h-2"}`}>
      <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function pctTone(pct: number | null): "ok" | "warn" | "bad" | "brand" {
  if (pct == null) return "brand";
  return pct >= 100 ? "ok" : pct >= 50 ? "brand" : "warn";
}

export function LevelBadge({ level }: { level: AlertLevel }) {
  const cls = level === "critico" ? "badge-bad" : level === "atencao" ? "badge-warn" : "badge-info";
  return <span className={`badge ${cls}`}>{LEVEL_LABEL[level]}</span>;
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span title={name} aria-label={name} style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-brand-fg">
      {initials(name) || "?"}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-sunken">{children}</Link>;
}
