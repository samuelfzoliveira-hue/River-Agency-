import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtDate } from "../lib/types";

interface Notif { id: string; titulo: string; mensagem: string | null; content_id: string | null; lida: boolean; created_at: string }

export default function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("id,titulo,mensagem,content_id,lida,created_at").order("created_at", { ascending: false }).limit(30);
    setItems((data as Notif[] | null) ?? []);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("notifications-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const unread = items.filter((n) => !n.lida).length;
  const openItem = async (n: Notif) => {
    if (!n.lida) await supabase.from("notifications").update({ lida: true }).eq("id", n.id);
    setOpen(false);
    load();
    if (n.content_id) navigate(`/conteudo/${n.content_id}`);
  };
  const markAll = async () => {
    await supabase.from("notifications").update({ lida: true }).eq("lida", false);
    load();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notificações${unread ? `, ${unread} novas` : ""}`} className="relative rounded-full p-2 hover:bg-paper">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-16 z-40 max-h-[70vh] overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-navy/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
            <div className="flex items-center justify-between border-b border-navy/10 px-4 py-3">
              <span className="font-semibold">Notificações</span>
              {unread > 0 && <button onClick={markAll} className="text-sm text-sky hover:underline">Marcar todas como lidas</button>}
            </div>
            {items.length === 0 ? <p className="px-4 py-8 text-center text-sm text-navy/50">Nenhuma notificação.</p> : items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)} className={`block w-full border-b border-navy/5 px-4 py-3 text-left hover:bg-paper ${n.lida ? "" : "bg-sky-soft/60"}`}>
                <p className="text-sm font-semibold">{n.titulo}</p>
                {n.mensagem && <p className="mt-0.5 line-clamp-2 text-sm text-navy/70">{n.mensagem}</p>}
                <p className="mt-1 text-xs text-navy/40">{fmtDate(n.created_at, true)}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
