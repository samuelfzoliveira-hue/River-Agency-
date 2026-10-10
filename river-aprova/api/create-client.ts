import { createClient } from "@supabase/supabase-js";

// Função serverless (Vercel): só um admin autenticado pode criar contas de cliente.
// Requer a variável SUPABASE_SERVICE_ROLE_KEY (chave secreta — nunca no front-end).
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return res.status(500).json({ error: "Servidor sem configuração (SUPABASE_SERVICE_ROLE_KEY ausente)." });
  }

  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Não autenticado." });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return res.status(401).json({ error: `Sessão inválida ou chave do servidor incorreta (${userError?.message ?? "sem usuário"}).` });
  }

  const { data: profile } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profile?.role !== "admin") return res.status(403).json({ error: "Apenas administradores." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "E-mail inválido." });
  if (password.length < 6) return res.status(400).json({ error: "A senha deve ter ao menos 6 caracteres." });

  // Pré-aprova o e-mail: o trigger de cadastro só aceita e-mails desta lista.
  const { error: allowError } = await admin.from("allowed_signups").upsert({ email });
  if (allowError) {
    return res.status(500).json({ error: `Banco sem a migração de cadastro (${allowError.message}).` });
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await admin.from("allowed_signups").delete().eq("email", email);
  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return res.status(exists ? 409 : 400).json({ error: exists ? "Este e-mail já tem conta." : `Não foi possível criar a conta (${error.message}).` });
  }
  return res.status(200).json({ id: data.user?.id, email });
}
