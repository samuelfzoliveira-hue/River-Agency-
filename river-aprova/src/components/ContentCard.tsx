import { Link } from "react-router-dom";
import { useSignedUrls } from "../lib/storage";
import { fmtDate, isOverdue, TIPO_LABEL, thumbPath, type Content } from "../lib/types";
import { IconCarousel, IconReels, StatusBadge } from "./ui";

export default function ContentCard({ content, showStatus = false, showClient = false }: { content: Content; showStatus?: boolean; showClient?: boolean }) {
  const path = thumbPath(content);
  const urls = useSignedUrls([path]);
  const overdue = isOverdue(content);
  return (
    <Link to={`/conteudo/${content.id}`} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-navy/5 transition hover:ring-sky/40">
      <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
        {path && urls[path] && <img src={urls[path]} alt="" className="h-full w-full object-cover" loading="lazy" />}
        {content.tipo !== "flyer" && (
          <span className="absolute right-1 top-1 text-white drop-shadow">{content.tipo === "carrossel" ? <IconCarousel className="h-4 w-4" /> : <IconReels className="h-4 w-4" />}</span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{TIPO_LABEL[content.tipo]}</span>
          {content.versao_atual > 1 && <span className="text-xs text-navy/50">v{content.versao_atual}</span>}
          {showStatus && <StatusBadge status={content.status} />}
        </div>
        {showClient && content.clients && <p className="mt-0.5 truncate text-sm text-navy/60">{content.clients.nome_marca}</p>}
        <p className="mt-1.5 text-sm text-navy/70">Publicação: {fmtDate(content.data_publicacao)}</p>
        {content.status === "aguardando" && (
          <p className={`text-sm ${overdue ? "font-semibold text-red-600" : "text-navy/70"}`}>
            Prazo: {fmtDate(content.prazo_aprovacao, true)}{overdue && " · vencido"}
          </p>
        )}
      </div>
    </Link>
  );
}
