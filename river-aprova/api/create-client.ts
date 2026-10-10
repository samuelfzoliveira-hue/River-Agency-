import { createClient } from "@supabase/supabase-js";

// Função serverless (Vercel): só um admin autenticado pode criar clientes.
// Requer SUPABASE_SERVICE_ROLE_KEY (chave secreta — nunca no front-end).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return res.status(500).json({ error: "Servidor sem configuração (SUPABASE_SERVICE_ROLE_KEY ausente)." });
  }

  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Não autenticado." });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return res.status(401).json({ error: "Sessão inválida." });

  const { data: profile } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profile?.role !== "admin") return res.status(403).json({ error: "Apenas administradores." });

  let body: any;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  } catch {
    return res.status(400).json({ error: "Requisição inválida." });
  }

  const id = String(body.id ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const nomeMarca = String(body.nome_marca ?? "").trim();
  const instagram = String(body.instagram ?? "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
  const bio = String(body.bio ?? "").trim().slice(0, 500);
  const foto = body.foto_perfil ? String(body.foto_perfil) : null;

  if (!UUID.test(id)) return res.status(400).json({ error: "Identificador inválido." });
  if (!nomeMarca) return res.status(400).json({ error: "Informe o nome da marca." });
  if (!/^[A-Za-z0-9._]{1,30}$/.test(instagram)) return res.status(400).json({ error: "@ do Instagram inválido." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "E-mail inválido." });
  if (password.length < 8) return res.status(400).json({ error: "A senha provisória deve ter ao menos 8 caracteres." });
  if (foto && (!foto.startsWith(`${id}/`) || foto.includes(".."))) return res.status(400).json({ error: "Foto inválida." });

  // Pré-aprova o e-mail: o trigger de cadastro só aceita e-mails desta lista.
  const { error: allowError } = await admin.from("allowed_signups").upsert({ email });
  if (allowError) return res.status(500).json({ error: `Banco sem a migração de cadastro (${allowError.message}).` });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await admin.from("allowed_signups").delete().eq("email", email);
  if (error || !data.user) {
    const exists = /already|registered|exists/i.test(error?.message ?? "");
    return res.status(exists ? 409 : 400).json({ error: exists ? "Este e-mail já tem conta." : `Não foi possível criar a conta (${error?.message}).` });
  }

  const userId = data.user.id;
  const { error: clientError } = await admin.from("clients").insert({
    id, user_id: userId, nome_marca: nomeMarca, instagram, foto_perfil: foto, bio: bio || null,
  });
  if (clientError) {
    await admin.auth.admin.deleteUser(userId); // desfaz a conta se o cadastro do cliente falhar
    return res.status(400).json({ error: `Não foi possível salvar o cliente (${clientError.message}).` });
  }
  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  return res.status(200).json({ id, email });
}
