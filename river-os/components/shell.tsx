"use client";

import { Bell, Building2, CalendarDays, Camera, Columns3, LayoutDashboard, ListChecks, Menu, Radar, Settings, User, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const ICONS = { dashboard: LayoutDashboard, radar: Radar, user: User, clients: Building2, pipeline: Columns3, tasks: ListChecks, calendar: CalendarDays, shoots: Camera, team: Users, bell: Bell, settings: Settings };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export function Shell({ nav, footer, children }: { nav: NavItem[]; footer: ReactNode; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const content = (
    <div className="flex h-full flex-col">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-fg">R</span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">RIVER OS</span>
          <span className="block text-[11px] text-muted">River Agency</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Principal">
        {nav.map((n) => {
          const Icon = ICONS[n.icon];
          const active = n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-brand text-brand-fg" : "text-muted hover:bg-sunken hover:text-fg"}`}>
              <Icon size={16} strokeWidth={1.75} />
              <span className="flex-1">{n.label}</span>
              {!!n.badge && <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? "bg-brand-fg/20" : "bg-bad text-white"}`}>{n.badge > 99 ? "99+" : n.badge}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 space-y-3 border-t border-line pt-4">{footer}</div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface p-4 md:block">{content}</aside>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-xs font-bold text-brand-fg">R</span> RIVER OS
        </Link>
        <button className="btn btn-sm" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={16} /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface p-4 shadow-xl">
            <button className="btn btn-sm absolute right-3 top-3" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={16} /></button>
            {content}
          </div>
        </div>
      )}
      <main className="px-4 py-6 md:ml-60 md:px-10 md:py-10">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
