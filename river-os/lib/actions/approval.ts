"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { BUCKET, pathBelongs } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./types";
import { actor, fail, refresh, str, uuid } from "./util";

const isHttp = (u: string) => /^https?:\/\/[^\s]+$/i.test(u);
const KINDS = ["imagem", "video", "documento"];

/** Nova versão (legenda + até 5 prévias por link). Versões são imutáveis: ficam como histórico. */
export async function createVersionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile, user } = await actor();
  const contentId = uuid.safeParse(str(fd, "content_id"));
  if (!contentId.success) return { error: "Conteúdo inválido." };
  const media: { name: string; url?: string; path?: string; kind: string }[] = [];
  const { data: ct } = await supabase.from("contents").select("client_id").eq("id", contentId.data).maybeSingle();
  if (!ct) return { error: "Conteúdo não encontrado." };
  for (let i = 0; i < 5; i++) {
    const path = str(fd, `media_path_${i}`);
    if (path) {
      if (!pathBelongs(path, profile.org_id, ct.client_id)) return { error: `Prévia ${i + 1}: arquivo inválido.` };
      const kind = str(fd, `media_kind_${i}`);
      media.push({ name: str(fd, `media_name_${i}`).slice(0, 120) || path.split("/")[2].replace(/^[0-9a-f-]{36}-/, ""), path, kind: KINDS.includes(kind) ? kind : "imagem" });
      continue;
    }
    const url = str(fd, `media_url_${i}`);
    if (!url) continue;
    if (!isHttp(url)) return { error: `Prévia ${i + 1}: informe um link http(s) válido.` };
    const kind = str(fd, `media_kind_${i}`);
    media.push({ name: str(fd, `media_name_${i}`).slice(0, 120) || `Prévia ${i + 1}`, url, kind: KINDS.includes(kind) ? kind : "imagem" });
  }
  const caption = str(fd, "caption");
  if (!caption && media.length === 0) return { error: "Informe a legenda e/ou ao menos uma prévia." };
  if (caption.length > 5000) return { error: "Legenda muito longa." };
  const { error } = await supabase.from("content_versions").insert({
    org_id: profile.org_id, content_id: contentId.data, caption, media, note: str(fd, "note") || null, created_by: user.id,
  });
  if (error) return fail(error);
  refresh();
  return { ok: "Nova versão criada. Envie ao cliente para valer a aprovação." };
}

/** Gera o link seguro (token de 256 bits; só o hash é guardado) e move o conteúdo para "aguardando aprovação". */
export async function sendApprovalAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await actor();
  const contentId = uuid.safeParse(str(fd, "content_id"));
  const days = Math.min(Math.max(Number(str(fd, "days")) || 14, 1), 60);
  if (!contentId.success) return { error: "Conteúdo inválido." };
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  // prévias enviadas por arquivo viram URLs assinadas válidas pelo prazo do link (o cliente não acessa o Storage)
  const { data: ver } = await supabase.from("content_versions").select("media").eq("content_id", contentId.data).order("version", { ascending: false }).limit(1).maybeSingle();
  const items = ((ver?.media ?? []) as { name: string; url?: string; path?: string; kind: string }[]);
  let snapshot: { name: string; url: string; kind: string }[] | null = null;
  if (items.some((m) => m.path)) {
    const paths = items.filter((m) => m.path).map((m) => m.path!);
    const { data: signedList } = await supabase.storage.from(BUCKET).createSignedUrls(paths, days * 86400);
    const byPath = new Map((signedList ?? []).map((d) => [d.path, d.signedUrl]));
    snapshot = items.flatMap((m) => { const url = m.path ? byPath.get(m.path) : m.url; return url ? [{ name: m.name, kind: m.kind, url }] : []; });
    if (snapshot.length < items.length) return { error: "Algum arquivo da versão não está mais disponível. Crie uma nova versão." };
  }
  const { error } = await supabase.rpc("request_approval", {
    p_content: contentId.data, p_token_hash: hash, p_expires: new Date(Date.now() + days * 86400e3).toISOString(), p_media: snapshot,
  });
  if (error) return fail(error);
  const h = await headers();
  const origin = h.get("origin") ?? (h.get("host") ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}` : process.env.NEXT_PUBLIC_SITE_URL ?? "");
  refresh();
  return { ok: `Enviado para aprovação. O link vale ${days} dias e é exibido só agora — copie e envie ao cliente. Links anteriores deste conteúdo foram desativados.`, link: `${origin}/aprovar/${token}` };
}

/** Decisão pelo link público (sem login). Quem decide informa o nome; tudo é registrado. */
export async function decideByLinkAction(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const action = str(fd, "decision");
  if (action !== "aprovado" && action !== "ajustes") return { error: "Escolha aprovar ou solicitar ajustes." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approval_decide", { p_token: token, p_action: action, p_comment: str(fd, "comment"), p_name: str(fd, "name") });
  if (error) return { error: error.message.length < 140 ? error.message : "Não foi possível registrar. Tente novamente." };
  return { ok: action === "aprovado" ? "Conteúdo aprovado. Obrigado!" : "Ajustes enviados à agência. Obrigado!" };
}

export async function decidePortalAction(contentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const action = str(fd, "decision");
  if (action !== "aprovado" && action !== "ajustes") return { error: "Escolha aprovar ou solicitar ajustes." };
  const { error } = await supabase.rpc("approval_decide_portal", { p_content: contentId, p_action: action, p_comment: str(fd, "comment") });
  if (error) return { error: error.message.length < 140 ? error.message : "Não foi possível registrar." };
  refresh();
  return { ok: action === "aprovado" ? "Conteúdo aprovado. Obrigado!" : "Ajustes enviados à agência. Obrigado!" };
}
