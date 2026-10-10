import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import ContentCard from "../components/ContentCard";
import ContentForm from "../components/ContentForm";
import Feed from "../components/Feed";
import { Avatar, Spinner } from "../components/ui";
import { supabase } from "../lib/supabase";
import { CONTENT_SELECT, type ClientInfo, type Content } from "../lib/types";

const TABS = [["conteudos", "Conteúdos"], ["feed", "Feed"], ["novo", "Novo conteúdo"]] as const;

export default function AdminClient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("conteudos");
  const [client, setClient] = useState<ClientInfo | null | undefined>(undefined);
  const [contents, setContents] = useState<Content[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [{ data: c }, { data: cs }] = await Promise.all([
      supabase.from("clients").select("id,nome_marca,instagram,foto_perfil,bio").eq("id", id!).maybeSingle(),
      supabase.from("contents").select(CONTENT_SELECT).eq("client_id", id!).order("created_at", { ascending: false }),
    ]);
    setClient((c as ClientInfo | null) ?? null);
    setContents((cs as Content[] | null) ?? []);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const reorder = async (ids: string[]) => {
    setError("");
    const { error: err } = await supabase.rpc("reorder_feed", { p_client: id, p_ids: ids });
    if (err) setError(err.message); else load();
  };

  if (client === undefined) return <AppLayout><div className="py-16 text-center"><Spinner /></div></AppLayout>;
  if (client === null) return <AppLayout><p className="rounded-2xl bg-white p-8 text-center text-sm">Cliente não encontrado. <Link className="link" to="/admin">Voltar</Link></p></AppLayout>;

  return (
    <AppLayout wide>
      <Link to="/admin" className="text-sm font-medium text-sky hover:underline">‹ Painel</Link>
      <div className="mt-3 flex items-center gap-3">
        <Avatar path={client.foto_perfil} name={client.nome_marca} size={56} />
        <div><h1 className="text-xl font-semibold">{client.nome_marca}</h1><p className="text-sm text-navy/60">@{client.instagram}</p></div>
      </div>
      <nav className="no-scrollbar -mx-4 my-5 flex gap-2 overflow-x-auto px-4">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${tab === k ? "bg-navy text-white" : "bg-white ring-1 ring-navy/10"}`}>{label}</button>
        ))}
      </nav>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {tab === "conteudos" && (contents.length === 0 ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-navy/60">Nenhum conteúdo ainda.</p>
        : <div className="grid gap-3 sm:grid-cols-2">{contents.map((c) => <ContentCard key={c.id} content={c} showStatus />)}</div>)}
      {tab === "feed" && <div className="mx-auto max-w-xl"><div className="-mx-4 sm:mx-0"><Feed client={client} contents={contents} editable onReorder={reorder} /></div></div>}
      {tab === "novo" && (
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy/5">
          <ContentForm clientId={client.id} mode="new" onDone={(cid) => navigate(`/conteudo/${cid}`)} />
        </div>
      )}
    </AppLayout>
  );
}
