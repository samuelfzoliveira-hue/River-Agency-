import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Rotina agendada (Vercel Cron / qualquer scheduler): roda as automações de todas as agências e envia por e-mail as
 * notificações pendentes. Exige `Authorization: Bearer $CRON_SECRET` e a chave de serviço do Supabase.
 * Sem RESEND_API_KEY + EMAIL_FROM faz "ensaio": não envia nem marca como enviado.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !serviceKey) return NextResponse.json({ error: "cron não configurado (CRON_SECRET / SUPABASE_SERVICE_ROLE_KEY)" }, { status: 503 });
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!safeEqual(given, secret)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });
  const { data: orgs } = await supabase.from("organizations").select("id");
  let created = 0;
  for (const o of orgs ?? []) {
    const { data } = await supabase.rpc("run_automations", { p_org: o.id, p_force: true });
    created += Number(data ?? 0);
  }

  const { data: queue } = await supabase.rpc("email_queue", { p_limit: 100 });
  const items = (queue ?? []) as { id: string; email: string; full_name: string; title: string; body: string | null; link: string | null }[];
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!key || !from) return NextResponse.json({ automations: created, emailsPending: items.length, emailsSent: 0, mode: "ensaio (sem RESEND_API_KEY/EMAIL_FROM)" });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const sent: string[] = [];
  for (const n of items) {
    const html = `<p>Olá, ${escapeHtml(n.full_name.split(" ")[0])}.</p><p><strong>${escapeHtml(n.title)}</strong></p>${n.body ? `<p>${escapeHtml(n.body)}</p>` : ""}${n.link && site ? `<p><a href="${site}${n.link}">Abrir no RIVER OS</a></p>` : ""}`;
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: n.email, subject: n.title, html }) });
    if (res.ok) sent.push(n.id);
  }
  if (sent.length) await supabase.rpc("email_mark_sent", { p_ids: sent });
  return NextResponse.json({ automations: created, emailsPending: items.length, emailsSent: sent.length });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
