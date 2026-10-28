/** Reconhece links do Google Drive/Docs e gera URLs de pré-visualização. Não usa a API do Drive (sem OAuth). */
export interface DriveRef { kind: "file" | "folder" | "doc"; id: string }

export function parseDriveLink(url: string): DriveRef | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "");
  if (host === "drive.google.com") {
    const folder = u.pathname.match(/\/folders\/([\w-]{10,})/);
    if (folder) return { kind: "folder", id: folder[1] };
    const file = u.pathname.match(/\/file\/d\/([\w-]{10,})/);
    if (file) return { kind: "file", id: file[1] };
    const id = u.searchParams.get("id");
    if (id && /^[\w-]{10,}$/.test(id) && (u.pathname === "/open" || u.pathname === "/uc")) return { kind: "file", id };
  }
  if (host === "docs.google.com") { const d = u.pathname.match(/\/d\/([\w-]{10,})/); if (d) return { kind: "doc", id: d[1] }; }
  return null;
}

/** Miniatura pública (funciona quando o arquivo está compartilhado por link). */
export function driveThumbnail(url: string, width = 1200): string | null {
  const ref = parseDriveLink(url);
  return ref && ref.kind === "file" ? `https://drive.google.com/thumbnail?id=${ref.id}&sz=w${width}` : null;
}
export const isDrive = (url: string) => parseDriveLink(url) !== null;
