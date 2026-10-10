export type ContentType = "flyer" | "carrossel" | "reels";
export type ContentStatus = "aguardando" | "aprovado" | "ajuste_solicitado" | "publicado";
export type MediaKind = "imagem" | "video" | "capa";

export interface Media { tipo: MediaKind; url: string; ordem: number }
export interface Version { numero_versao: number; legenda: string; created_at: string; content_media: Media[] }
export interface ClientInfo { id: string; nome_marca: string; instagram: string; foto_perfil: string | null; bio: string | null }
export interface Content {
  id: string; client_id: string; tipo: ContentType; status: ContentStatus;
  data_publicacao: string | null; prazo_aprovacao: string | null; ordem_feed: number;
  ja_publicado: boolean; versao_atual: number; created_at: string;
  clients: ClientInfo | null; content_versions: Version[];
}
export interface LogEntry {
  id: string; numero_versao: number; acao: "aprovado" | "ajuste_solicitado" | "reaberto";
  comentario: string | null; slide_referencia: number | null; tempo_video_referencia: string | null; created_at: string;
}

export const TIPO_LABEL: Record<ContentType, string> = { flyer: "Flyer", carrossel: "Carrossel", reels: "Reels" };
export const STATUS_LABEL: Record<ContentStatus, string> = {
  aguardando: "Aguardando aprovação", aprovado: "Aprovado", ajuste_solicitado: "Ajuste solicitado", publicado: "Publicado",
};

export const CONTENT_SELECT =
  "*, clients(id,nome_marca,instagram,foto_perfil,bio), content_versions(numero_versao,legenda,created_at,content_media(tipo,url,ordem))";

export function versionOf(c: Content, n = c.versao_atual): Version | undefined {
  return c.content_versions.find((v) => v.numero_versao === n);
}
export function sortedMedia(v?: Version): Media[] {
  return [...(v?.content_media ?? [])].sort((a, b) => a.ordem - b.ordem);
}
/** Miniatura: flyer/carrossel = 1ª imagem; reels = capa. */
export function thumbPath(c: Content): string | undefined {
  const m = sortedMedia(versionOf(c));
  return (c.tipo === "reels" ? m.find((x) => x.tipo === "capa") : m.find((x) => x.tipo === "imagem"))?.url;
}
export function isOverdue(c: Content) {
  return c.status === "aguardando" && !!c.prazo_aprovacao && new Date(c.prazo_aprovacao).getTime() < Date.now();
}
export function fmtDate(d: string | null, withTime = false) {
  if (!d) return "—";
  const date = d.length === 10 ? new Date(`${d}T12:00:00`) : new Date(d);
  return date.toLocaleString("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" });
}
