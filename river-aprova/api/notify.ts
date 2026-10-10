import { createClient } from "@supabase/supabase-js";

// Envia e-mails de notificação (via Resend). Variáveis: RESEND_API_KEY, RESEND_FROM (opcional), APP_URL (opcional).
// - kind "decisao": chamado pelo cliente após aprovar/pedir ajuste -> e-mail ao admin.
// - kind "aguardando": chamado pelo admin após enviar conteúdo/versão -> e-mail ao cliente.
const ADMIN_EMAIL = "riiveragency@gmail.com";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F7F6F2;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0B1F4B">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F2;padding:24px 12px"><tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0B1F4B;padding:20px 28px;color:#fff;font-size:20px;font-weight:700">River <span style="color:#4DA3FF">Aprova</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:20px;color:#0B1F4B">${esc(title)}</h1>
${bodyHtml}
<p style="margin:28px 0 0"><a href="${esc(ctaUrl)}" style="display:inline-block;background:#0B1F4B;color:#fff;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:600">${esc(ctaLabel)}</a></p>
</td></tr>
<tr><td style="padding:16px 28px;background:#F7F6F2;color:#6b7690;font-size:12px">River Agency · Aprovação de conteúdo</td></tr>
</table></td></tr></table></body></html>`;
}
const row = (label: string, value: string) =>
  `<p style="margin:0 0 10px;font-size:15px;line-height:1.5"><span style="color:#6b7690">${esc(label)}:</span> <strong>${esc(value)}</strong></p>`;
const TIPO: Record<string, string> = { flyer: "Flyer", carrossel: "Carrossel", reels: "Reels" };

async function send(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY ausente" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.RESEND_FROM ?? "River Aprova <onboarding@resend.dev>", to: [to], subject, html }),
  });
  return r.ok ? { sent: true } : { sent: false, reason: `Resend ${r.status}` };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: "Servidor sem configuração." });

  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: u } = await admin.auth.getUser(token);
  if (!u.user) return res.status(401).json({ error: "Não autenticado." });

  let body: any;
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {}; } catch { body = {}; }
  const kind = String(body.kind ?? "");
  const contentId = String(body.content_id ?? "");

  const { data: content } = await admin
    .from("contents")
    .select("id, tipo, status, data_publicacao, prazo_aprovacao, versao_atual, clients(id, user_id, nome_marca)")
    .eq("id", contentId).maybeSingle();
  const client = (content as any)?.clients;
  if (!content || !client) return res.status(404).json({ error: "Conteúdo não encontrado." });

  const origin = process.env.APP_URL ?? `https://${req.headers["x-forwarded-host"] ?? req.headers.host}`;
  const link = `${origin}/conteudo/${content.id}`;
  const tipo = TIPO[(content as any).tipo] ?? "Conteúdo";

  const { data: prof } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  const isAdmin = prof?.role === "admin";

  if (kind === "decisao") {
    if (client.user_id !== u.user.id) return res.status(403).json({ error: "Acesso negado." });
    // Reivindica o último registro ainda não notificado (evita e-mails duplicados/abuso).
    const { data: logs } = await admin.from("approval_log").select("id, acao, comentario, slide_referencia, tempo_video_referencia, numero_versao")
      .eq("content_id", contentId).eq("notified", false).in("acao", ["aprovado", "ajuste_solicitado"])
      .order("created_at", { ascending: false }).limit(1);
    const log = logs?.[0];
    if (!log) return res.status(200).json({ sent: false, reason: "nada a notificar" });
    const { data: claimed } = await admin.from("approval_log").update({ notified: true }).eq("id", log.id).eq("notified", false).select("id");
    if (!claimed?.length) return res.status(200).json({ sent: false, reason: "já notificado" });

    const aprovado = log.acao === "aprovado";
    const ref = log.slide_referencia ? `Slide ${log.slide_referencia}` : log.tempo_video_referencia ? `Trecho ${log.tempo_video_referencia}` : "";
    const html = layout(
      aprovado ? "Conteúdo aprovado" : "Ajuste solicitado",
      row("Cliente", client.nome_marca) + row("Peça", `${tipo} (versão ${log.numero_versao})`) +
        row("Decisão", aprovado ? "Aprovado" : "Ajuste solicitado") +
        (log.comentario ? row("Comentário", log.comentario) : "") + (ref ? row("Referência", ref) : ""),
      "Abrir conteúdo", link);
    const out = await send(ADMIN_EMAIL, `${client.nome_marca}: ${aprovado ? "conteúdo aprovado" : "ajuste solicitado"}`, html);
    return res.status(200).json(out);
  }

  if (kind === "aguardando") {
    if (!isAdmin) return res.status(403).json({ error: "Apenas administradores." });
    if ((content as any).status !== "aguardando") return res.status(200).json({ sent: false, reason: "não está aguardando" });
    const { data: au } = await admin.auth.admin.getUserById(client.user_id);
    const to = au.user?.email;
    if (!to) return res.status(200).json({ sent: false, reason: "cliente sem e-mail" });
    const prazo = (content as any).prazo_aprovacao
      ? new Date((content as any).prazo_aprovacao).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—";
    const nova = (content as any).versao_atual > 1;
    const html = layout(
      nova ? "Nova versão aguardando sua aprovação" : "Novo conteúdo aguardando sua aprovação",
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Olá! Há um material novo da River Agency para você revisar.</p>` +
        row("Peça", `${tipo}${nova ? ` (versão ${(content as any).versao_atual})` : ""}`) + row("Prazo para aprovação", prazo),
      "Revisar e aprovar", link);
    const out = await send(to, nova ? "Nova versão aguardando sua aprovação" : "Novo conteúdo aguardando sua aprovação", html);
    return res.status(200).json(out);
  }
  return res.status(400).json({ error: "Tipo de notificação inválido." });
}
