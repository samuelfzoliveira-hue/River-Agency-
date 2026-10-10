import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AppLayout from "../components/AppLayout";
import ApprovalPanel from "../components/ApprovalPanel";
import { Feedback } from "../components/AuthShell";
import ContentForm from "../components/ContentForm";
import PostViewer from "../components/PostViewer";
import { Modal, Spinner, StatusBadge } from "../components/ui";
import { supabase } from "../lib/supabase";
import { CONTENT_SELECT, fmtDate, isOverdue, TIPO_LABEL, versionOf, type Content, type LogEntry } from "../lib/types";

const ACAO: Record<LogEntry["acao"], string> = { aprovado: "Aprovado", ajuste_solicitado: "Ajuste solicitado", reaberto: "Reaberto pela agência" };

export default function ContentPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";
  const [content, setContent] = useState<Content | null | undefined>(undefined);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [modal, setModal] = useState<"reabrir" | "versao" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: c }, { data: l }] = await Promise.all([
      supabase.from("contents").select(CONTENT_SELECT).eq("id", id!).maybeSingle(),
      supabase.from("approval_log").select("id,numero_versao,acao,comentario,slide_referencia,tempo_video_referencia,created_at").eq("content_id", id!).order("created_at"),
    ]);
    setContent((c as Content | null) ?? null);
    setLog((l as LogEntry[] | null) ?? []);
    setViewing(null);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const back = isAdmin && content ? `/admin/clientes/${content.client_id}` : "/conteudos";
  const act = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true); setError("");
    const { error: err } = await fn();
    setBusy(false);
    if (err) return setError(err.message);
    setModal(null); setNote(""); load();
  };

  if (content === undefined) return <AppLayout><div className="py-16 text-center"><Spinner /></div></AppLayout>;
  if (content === null) return <AppLayout><p className="rounded-2xl bg-white p-8 text-center text-sm text-navy/60">Conteúdo não encontrado.</p><p className="mt-4 text-center"><Link className="link" to="/conteudos">Voltar</Link></p></AppLayout>;

  const shown = viewing ?? content.versao_atual;
  const version = versionOf(content, shown) ?? content.content_versions[0];
  const isCurrent = shown === content.versao_atual;
  const versions = [...content.content_versions].sort((a, b) => b.numero_versao - a.numero_versao);
  const events = [
    ...content.content_versions.map((v) => ({ at: v.created_at, kind: "versao" as const, v: v.numero_versao })),
    ...log.map((l) => ({ at: l.created_at, kind: "log" as const, l })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <AppLayout>
      <div className="-mx-4 sm:mx-0">
        <div className="mb-3 flex items-center justify-between px-4 sm:px-0">
          <Link to={back} className="text-sm font-medium text-sky hover:underline">‹ Voltar</Link>
          <StatusBadge status={content.status} />
        </div>
        <PostViewer content={content} version={version} />
      </div>

      <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-navy/5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-navy/70">
          <span>{TIPO_LABEL[content.tipo]} · Publicação: {fmtDate(content.data_publicacao)}</span>
          {content.status === "aguardando" && (
            <span className={isOverdue(content) ? "font-semibold text-red-600" : ""}>Prazo: {fmtDate(content.prazo_aprovacao, true)}{isOverdue(content) && " · vencido"}</span>
          )}
        </div>
        {versions.length > 1 && (
          <div className="mt-3">
            <label className="mr-2 text-sm font-medium">Versão</label>
            <select value={shown} onChange={(e) => setViewing(Number(e.target.value))} className="rounded-lg border border-navy/15 px-2 py-1.5 text-sm">
              {versions.map((v) => <option key={v.numero_versao} value={v.numero_versao}>v{v.numero_versao}{v.numero_versao === content.versao_atual ? " (atual)" : ""} · {fmtDate(v.created_at)}</option>)}
            </select>
            {!isCurrent && <p className="mt-2 text-sm text-amber-700">Você está vendo uma versão anterior (somente leitura).</p>}
          </div>
        )}

        <div className="mt-4">
          {error && <div className="mb-3"><Feedback kind="error">{error}</Feedback></div>}
          {!isAdmin && content.status === "aguardando" && isCurrent && <ApprovalPanel content={content} onDone={load} />}
          {!isAdmin && content.status === "aprovado" && <Feedback kind="ok">Você aprovou este conteúdo. Ele está bloqueado — só a River Agency pode reabri-lo.</Feedback>}
          {!isAdmin && content.status === "ajuste_solicitado" && <Feedback kind="ok">Ajuste solicitado. Avisaremos quando houver uma nova versão.</Feedback>}
          {!isAdmin && content.status === "publicado" && <Feedback kind="ok">Este conteúdo já foi publicado.</Feedback>}

          {isAdmin && (
            <div className="flex flex-wrap gap-3">
              {content.status === "aprovado" && <>
                <button className="btn sm:w-auto" disabled={busy} onClick={() => act(() => supabase.rpc("mark_published", { p_content: content.id }))}>Marcar como publicado</button>
                <button className="rounded-xl border border-navy/20 px-5 py-3 font-semibold" onClick={() => setModal("reabrir")}>Reabrir aprovação</button>
              </>}
              {content.status === "ajuste_solicitado" && <button className="btn sm:w-auto" onClick={() => setModal("versao")}>Enviar nova versão</button>}
              {(content.status === "aguardando" || content.status === "publicado") && <p className="text-sm text-navy/60">{content.status === "aguardando" ? "Aguardando decisão do cliente." : "Conteúdo publicado."}</p>}
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-navy/5">
        <h2 className="font-semibold">Histórico</h2>
        <ol className="mt-3 space-y-3">
          {events.map((e, i) => e.kind === "versao" ? (
            <li key={i} className="border-l-2 border-sky/50 pl-3 text-sm"><strong>Versão {e.v}</strong> enviada <span className="text-navy/50">· {fmtDate(e.at, true)}</span></li>
          ) : (
            <li key={i} className={`border-l-2 pl-3 text-sm ${e.l.acao === "aprovado" ? "border-emerald-500" : e.l.acao === "reaberto" ? "border-navy/30" : "border-red-400"}`}>
              <strong>{ACAO[e.l.acao]}</strong> <span className="text-navy/50">· v{e.l.numero_versao} · {fmtDate(e.at, true)}</span>
              {(e.l.slide_referencia || e.l.tempo_video_referencia) && <span className="ml-2 rounded bg-paper px-1.5 py-0.5 text-xs">{e.l.slide_referencia ? `Slide ${e.l.slide_referencia}` : `Trecho ${e.l.tempo_video_referencia}`}</span>}
              {e.l.comentario && <p className="mt-1 whitespace-pre-wrap break-words text-navy/80">{e.l.comentario}</p>}
            </li>
          ))}
        </ol>
      </section>

      {modal === "reabrir" && (
        <Modal title="Reabrir aprovação" onClose={() => setModal(null)}>
          <p className="text-sm text-navy/70">O conteúdo volta para "aguardando" e o cliente poderá decidir de novo.</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Motivo (opcional)" className="field mt-3" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="rounded-xl border border-navy/20 px-4 py-3 font-semibold" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn" disabled={busy} onClick={() => act(() => supabase.rpc("reopen_content", { p_content: content.id, p_comentario: note }))}>Reabrir</button>
          </div>
        </Modal>
      )}
      {modal === "versao" && (
        <Modal title="Enviar nova versão" onClose={() => setModal(null)}>
          <ContentForm clientId={content.client_id} mode="version" content={content} onDone={() => { setModal(null); navigate(0); }} />
        </Modal>
      )}
    </AppLayout>
  );
}
