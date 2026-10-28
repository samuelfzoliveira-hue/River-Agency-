import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Shell, type NavItem } from "@/components/shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/db";
import { getCtx, isManager } from "@/lib/session";
import { logout } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (!ctx.profile || !ctx.profile.active) redirect("/onboarding");
  const { profile, supabase } = ctx;
  if (profile.role === "cliente") redirect("/cliente");

  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const manager = isManager(profile.role);
  const nav: NavItem[] = [
    ...(manager ? ([{ href: "/", label: "Visão geral", icon: "dashboard" }, { href: "/operacoes", label: "Central de Operações", icon: "radar" }, { href: "/fechamento", label: "Fechamento mensal", icon: "closing" }] as NavItem[]) : []),
    { href: "/meu-painel", label: "Meu painel", icon: "user" },
    { href: "/clientes", label: "Clientes", icon: "clients" },
    { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
    { href: "/tarefas", label: "Tarefas", icon: "tasks" },
    { href: "/calendario", label: "Calendário", icon: "calendar" },
    { href: "/captacoes", label: "Captações", icon: "shoots" },
    { href: "/midia", label: "Banco de mídia", icon: "media" },
    { href: "/equipe", label: "Equipe", icon: "team" },
    { href: "/notificacoes", label: "Notificações", icon: "bell", badge: count ?? 0 },
    ...(profile.role === "admin" ? ([{ href: "/configuracoes", label: "Configurações", icon: "settings" }] as NavItem[]) : []),
  ];

  return (
    <Shell
      nav={nav}
      footer={
        <>
          <div className="flex items-center gap-2.5 px-1">
            <Avatar name={profile.full_name || profile.email || "?"} size={32} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">{profile.full_name || profile.email}</p>
              <p className="truncate text-[11px] text-muted">{ROLE_LABEL[profile.role]}</p>
            </div>
          </div>
          <ThemeToggle />
          <form action={logout}><button className="btn btn-sm w-full justify-start"><LogOut size={14} /> Sair</button></form>
        </>
      }
    >
      {children}
    </Shell>
  );
}
