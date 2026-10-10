import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import ContentCard from "../components/ContentCard";
import Feed from "../components/Feed";
import { Spinner } from "../components/ui";
import { supabase } from "../lib/supabase";
import { CONTENT_SELECT, type ClientInfo, type Content, type ContentStatus } from "../lib/types";

const TABS: { key: string; label: string; status?: ContentStatus; empty: string }[] = [
  { key: "aguardando", label: "Aguardando aprovação", status: "aguardando", empty: "Nada aguardando sua aprovação. 🎉" },
  { key: "ajuste", label: "Ajuste solicitado", status: "ajuste_solicitado", empty: "Nenhum ajuste em andamento." },
  { key: "aprovados", label: "Aprovados", status: "aprovado", empty: "Nenhum conteúdo aprovado ainda." },
  { key: "publicados", label: "Publicados", status: "publicado", empty: "Nenhum conteúdo publicado ainda." },
  { key: "feed", label: "Meu feed", empty: "" },
];

export default function Conteudos() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get("aba")) ?? TABS[0];
  const [client, setClient] = useState<ClientInfo | null | undefined>(undefined);
  const [contents, setContents] = useState<Content[] | null>(null);

  const load = useCallback(async () => {
    const [{ data: cl }, { data: cs }] = await Promise.all([
      supabase.from("clients").select("id,nome_marca,instagram,foto_perfil,bio").maybeSingle(),
      supabase.from("contents").select(CONTENT_SELECT).order("created_at", { ascending: false }),
    ]);
    setClient((cl as ClientInfo | null) ?? null);
    setContents((cs as Content[] | null) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const count = (s: ContentStatus) => contents?.filter((c) => c.status === s).length ?? 0;
  const list = (contents ?? []).filter((c) => c.status === tab.status)
    .sort((a, b) => (a.prazo_aprovacao ?? a.created_at).localeCompare(b.prazo_aprovacao ?? b.created_at));

  return (
    <AppLayout>
      {client && <p className="mb-4 text-sm text-navy/60">Olá, <strong className="text-navy">{client.nome_marca}</strong></p>}
      <nav className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4" aria-label="Seções">
        {TABS.map((t) => {
          const active = t.key === tab.key;
          const n = t.status ? count(t.status) : 0;
          const highlight = t.key === "aguardando" && n > 0;
          return (
            <button key={t.key} onClick={() => setParams(t.key === "aguardando" ? {} : { aba: t.key })}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-navy text-white" : "bg-white text-navy ring-1 ring-navy/10"}`}>
              {t.label}
              {t.status && n > 0 && (
                <span className={`rounded-full px-2 text-xs font-bold ${highlight ? "bg-red-600 text-white" : active ? "bg-white/20" : "bg-paper"}`}>{n}</span>
              )}
            </button>
          );
        })}
      </nav>

      {contents === null ? <div className="py-10 text-center"><Spinner /></div>
        : !client ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-navy/60">Seu cadastro de cliente ainda não foi concluído. Fale com a River Agency.</p>
        : tab.key === "feed" ? <div className="-mx-4 sm:mx-0"><Feed client={client} contents={contents} /></div>
        : list.length === 0 ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-navy/60">{tab.empty}</p>
        : <div className="space-y-3">{list.map((c) => <ContentCard key={c.id} content={c} />)}</div>}
    </AppLayout>
  );
}
