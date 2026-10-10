import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSignedUrls } from "../lib/storage";
import { thumbPath, type ClientInfo, type Content } from "../lib/types";
import { Avatar, IconCarousel, IconReels } from "./ui";

const PENDING_LABEL: Record<string, string> = { aguardando: "Aguardando", ajuste_solicitado: "Ajuste" };

export default function Feed({ client, contents, editable = false, onReorder }: {
  client: ClientInfo; contents: Content[]; editable?: boolean; onReorder?: (ids: string[]) => Promise<void> | void;
}) {
  const [onlyApproved, setOnlyApproved] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const baseNovos = useMemo(
    () => contents.filter((c) => c.status !== "publicado").sort((a, b) => a.ordem_feed - b.ordem_feed || (b.data_publicacao ?? "").localeCompare(a.data_publicacao ?? "")),
    [contents],
  );
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => setOrder(baseNovos.map((c) => c.id)), [baseNovos]);
  const novos = order.map((id) => baseNovos.find((c) => c.id === id)).filter(Boolean) as Content[];
  const publicados = useMemo(
    () => contents.filter((c) => c.status === "publicado").sort((a, b) => (b.data_publicacao ?? b.created_at).localeCompare(a.data_publicacao ?? a.created_at)),
    [contents],
  );

  const visible = (list: Content[]) => (onlyApproved ? list.filter((c) => c.status === "aprovado" || c.status === "publicado") : list);
  const tiles = [...visible(novos), ...visible(publicados)];
  const urls = useSignedUrls(tiles.map(thumbPath));
  const canReorder = editable && reorder && !onlyApproved;

  const move = (id: string, toId: string) => {
    if (id === toId) return;
    const next = order.filter((x) => x !== id);
    next.splice(next.indexOf(toId), 0, id);
    setOrder(next);
    onReorder?.(next);
  };
  const nudge = (id: string, d: number) => {
    const i = order.indexOf(id), j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    onReorder?.(next);
  };

  return (
    <section className="overflow-hidden bg-white ring-1 ring-navy/5 sm:rounded-2xl">
      <div className="px-4 pb-4 pt-5">
        <div className="flex items-center gap-5">
          <Avatar path={client.foto_perfil} name={client.nome_marca} size={80} />
          <div className="flex flex-1 justify-around text-center">
            <div><p className="text-lg font-semibold">{contents.length}</p><p className="text-xs text-navy/60">publicações</p></div>
          </div>
        </div>
        <p className="mt-3 font-semibold">{client.nome_marca}</p>
        <p className="text-sm text-navy/50">@{client.instagram}</p>
        {client.bio && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{client.bio}</p>}
      </div>
      <div className="flex items-center gap-2 border-y border-navy/10 px-4 py-2.5">
        {[false, true].map((v) => (
          <button key={String(v)} onClick={() => setOnlyApproved(v)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${onlyApproved === v ? "bg-navy text-white" : "bg-paper text-navy/70"}`}>
            {v ? "Somente aprovados" : "Todos"}
          </button>
        ))}
        <span className="flex-1" />
        {editable && (
          <button onClick={() => setReorder((r) => !r)} disabled={onlyApproved}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium disabled:opacity-40 ${reorder ? "bg-sky text-white" : "bg-sky-soft text-navy"}`}>
            {reorder ? "Concluir" : "Reordenar"}
          </button>
        )}
      </div>
      {reorder && editable && <p className="bg-sky-soft px-4 py-2 text-xs text-navy/70">Arraste os conteúdos novos (ou use ‹ ›) para definir a ordem do feed. Os já publicados ficam no fim.</p>}
      {tiles.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-navy/50">Nenhum conteúdo para mostrar.</p>
      ) : (
        <div className="grid grid-cols-3 gap-[2px] bg-navy/5">
          {tiles.map((c) => {
            const p = thumbPath(c);
            const draggable = canReorder && c.status !== "publicado";
            const inner = (
              <>
                {p && urls[p] ? <img src={urls[p]} alt="" loading="lazy" className="h-full w-full object-cover" draggable={false} /> : <div className="h-full w-full animate-pulse bg-neutral-200" />}
                {c.tipo !== "flyer" && (
                  <span className="absolute right-1.5 top-1.5 text-white drop-shadow">{c.tipo === "carrossel" ? <IconCarousel className="h-4 w-4" /> : <IconReels className="h-4 w-4" />}</span>
                )}
                {PENDING_LABEL[c.status] && (
                  <span className={`absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.status === "aguardando" ? "bg-amber-100/95 text-amber-800" : "bg-red-100/95 text-red-700"}`}>{PENDING_LABEL[c.status]}</span>
                )}
                {draggable && (
                  <span className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-1">
                    <button onClick={() => nudge(c.id, -1)} aria-label="Mover para antes" className="h-7 w-7 rounded-full bg-white/90 text-navy">‹</button>
                    <button onClick={() => nudge(c.id, 1)} aria-label="Mover para depois" className="h-7 w-7 rounded-full bg-white/90 text-navy">›</button>
                  </span>
                )}
              </>
            );
            const cls = `relative aspect-[3/4] overflow-hidden bg-neutral-100 ${draggable ? "cursor-grab ring-2 ring-sky/60 ring-inset" : ""} ${dragId === c.id ? "opacity-40" : ""}`;
            return canReorder ? (
              <div key={c.id} className={cls} draggable={draggable}
                onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)}
                onDragOver={(e) => draggable && e.preventDefault()}
                onDrop={() => dragId && draggable && move(dragId, c.id)}>{inner}</div>
            ) : (
              <Link key={c.id} to={`/conteudo/${c.id}`} className={cls}>{inner}</Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
