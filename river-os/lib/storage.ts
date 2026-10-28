import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "media";
export const MAX_BYTES = 50 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm", "application/pdf"];

export const kindFromMime = (mime: string): "imagem" | "video" | "documento" => (mime.startsWith("image/") ? "imagem" : mime.startsWith("video/") ? "video" : "documento");

/** Nome seguro para o caminho: sem acentos, barras ou caracteres de controle. */
export function safeFileName(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  const ext = (base.match(/\.[A-Za-z0-9]{1,5}$/)?.[0] ?? "").toLowerCase();
  const stem = base.slice(0, base.length - ext.length).slice(0, 60).replace(/[-.]+$/, "") || "arquivo";
  return stem + ext;
}

export const buildPath = (orgId: string, clientId: string, fileName: string, id: string) => `${orgId}/${clientId}/${id}-${safeFileName(fileName)}`;
/** O caminho precisa pertencer à agência (e, se informado, ao cliente) — validado de novo no servidor. */
export const pathBelongs = (path: string, orgId: string, clientId?: string) =>
  !path.includes("..") && path.startsWith(`${orgId}/${clientId ? clientId + "/" : ""}`) && path.split("/").length === 3;

/** URLs assinadas (acesso temporário a um arquivo privado). Retorna Map caminho → URL. */
export async function signPaths(supabase: SupabaseClient, paths: string[], seconds = 3600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths)];
  if (!unique.length) return out;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, seconds);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}
