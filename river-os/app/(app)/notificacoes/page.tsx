import Link from "next/link";
import { SubmitButton } from "@/components/form";
import { Empty, PageHeader } from "@/components/ui";
import { markAllNotificationsAction, markNotificationAction } from "@/lib/actions/misc";
import type { NotificationRow } from "@/lib/db";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Notificações" };

export default async function Notifications() {
  const { supabase } = await requireCtx();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const list = (data ?? []) as NotificationRow[];
  const unread = list.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader title="Notificações" subtitle="Tarefas atribuídas, aprovações, captações concluídas e menções. Os alertas de prazo e capacidade aparecem na Central de Operações."
        actions={unread > 0 && <form action={markAllNotificationsAction}><SubmitButton className="btn" pendingText="…">Marcar todas como lidas</SubmitButton></form>} />
      {list.length === 0 ? <Empty>Nenhuma notificação.</Empty> : (
        <ul className="card divide-y divide-line">
          {list.map((n) => (
            <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.read_at ? "opacity-60" : ""}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-bad"}`} aria-label={n.read_at ? "lida" : "não lida"} />
              <div className="min-w-0 flex-1 text-sm">
                {n.link ? <Link href={n.link} className="font-medium hover:underline">{n.title}</Link> : <p className="font-medium">{n.title}</p>}
                {n.body && <p className="text-muted">{n.body}</p>}
                <p className="mt-0.5 text-[11px] text-muted">{new Date(n.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</p>
              </div>
              {!n.read_at && <form action={markNotificationAction}><input type="hidden" name="id" value={n.id} /><button className="text-xs text-muted hover:text-fg">marcar lida</button></form>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
