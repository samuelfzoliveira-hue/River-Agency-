import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { Feedback } from "../components/AuthShell";
import { Avatar, Spinner } from "../components/ui";
import { callApi, supabase } from "../lib/supabase";
import { uploadFile } from "../lib/storage";
import { fmtDate, TIPO_LABEL, type ClientInfo, type ContentStatus, type ContentType, type LogEntry } from "../lib/types";

interface Adjust { id: string; tipo: ContentType; versao_atual: number; clients: { nome_marca: string } | null; approval_log: LogEntry[] }
interface ClientRow extends ClientInfo { user_id: string; contents: { status: ContentStatus }[] }

const genPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

export default function Admin() {
  const [adjusts, setAdjusts] = useState<Adjust[] | null>(null);
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome_marca: "", instagram: "", bio: "", email: "", password: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: a }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("contents").select("id,tipo,versao_atual,clients(nome_marca),approval_log(id,numero_versao,acao,comentario,slide_referencia,tempo_video_referencia,created_at)").eq("status", "ajuste_solicitado"),
      supabase.from("clients").select("id,user_id,nome_marca,instagram,foto_perfil,bio,contents(status)").order("nome_marca"),
      supabase.from("profiles").select("id,email").eq("role", "cliente"),
    ]);
    setAdjusts((a as unknown as Adjust[] | null) ?? []);
    setClients((c as unknown as ClientRow[] | null) ?? []);
    setEmails(Object.fromEntries(((p as { id: string; email: string }[] | null) ?? []).map((r) => [r.id, r.email])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const id = crypto.randomUUID();
    try {
      let foto: string | null = null;
      if (photo) foto = await uploadFile(id, photo);
      const { ok, data } = await callApi<{ email: string }>("/api/create-client", { id, ...form, foto_perfil: foto });
      if (!ok) {
        if (foto) await supabase.storage.from("media").remove([foto]);
        setMsg({ kind: "error", text: data.error ?? "Não foi possível criar o cliente." });
      } else {
        setMsg({ kind: "ok", text: `Cliente criado. Envie ao cliente: e-mail ${form.email} e a senha provisória (ele precisará trocá-la no primeiro acesso).` });
        setForm({ nome_marca: "", instagram: "", bio: "", email: "", password: "" });
        setPhoto(null);
        load();
      }
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : "Falha ao enviar a foto." });
    }
    setBusy(false);
  };

  return (
    <AppLayout title="Painel" wide>
      <section className={`rounded-2xl p-5 ring-1 ${adjusts?.length ? "bg-red-50 ring-red-200" : "bg-white ring-navy/5"}`}>
        <h2 className="text-lg font-semibold">Ajustes solicitados {adjusts && adjusts.length > 0 && <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-sm text-white">{adjusts.length}</span>}</h2>
        {adjusts === null ? <div className="py-4"><Spinner /></div> : adjusts.length === 0 ? <p className="mt-2 text-sm text-navy/60">Nenhum ajuste pendente.</p> : (
          <ul className="mt-3 space-y-3">
            {adjusts.map((c) => {
              const l = c.approval_log.filter((x) => x.acao === "ajuste_solicitado" && x.numero_versao === c.versao_atual).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
              return (
                <li key={c.id}>
                  <Link to={`/conteudo/${c.id}`} className="block rounded-xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-sky/40">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                      <span><strong>{c.clients?.nome_marca}</strong> · {TIPO_LABEL[c.tipo]} v{c.versao_atual}</span>
                      <span className="text-navy/50">{l && fmtDate(l.created_at, true)}</span>
                    </div>
                    {l?.comentario && <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-navy/80">{l.comentario}</p>}
                    {(l?.slide_referencia || l?.tempo_video_referencia) && <span className="mt-2 inline-block rounded bg-paper px-2 py-0.5 text-xs">{l.slide_referencia ? `Slide ${l.slide_referencia}` : `Trecho ${l.tempo_video_referencia}`}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy/5">
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
          <h2 className="text-lg font-semibold">Novo cliente</h2><span className="text-xl text-sky">{open ? "−" : "+"}</span>
        </button>
        {open && (
          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="field" required placeholder="Nome da marca" value={form.nome_marca} onChange={set("nome_marca")} />
            <input className="field" required placeholder="@ do Instagram" value={form.instagram} onChange={set("instagram")} />
            <textarea className="field sm:col-span-2" rows={3} maxLength={500} placeholder="Bio do perfil" value={form.bio} onChange={set("bio")} />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Foto de perfil</label>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="field" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </div>
            <input className="field" type="email" required placeholder="E-mail de acesso" value={form.email} onChange={set("email")} />
            <div className="flex gap-2">
              <input className="field" required minLength={8} autoComplete="off" placeholder="Senha provisória (mín. 8)" value={form.password} onChange={set("password")} />
              <button type="button" onClick={() => setForm((f) => ({ ...f, password: genPassword() }))} className="shrink-0 rounded-xl border border-navy/20 px-3 text-sm font-medium">Gerar</button>
            </div>
            <div className="sm:col-span-2"><button className="btn sm:w-auto" disabled={busy}>{busy ? "Criando…" : "Criar cliente"}</button></div>
          </form>
        )}
        {msg && <div className="mt-3"><Feedback kind={msg.kind}>{msg.text}</Feedback></div>}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Clientes {clients && `(${clients.length})`}</h2>
        {clients === null ? <div className="py-4"><Spinner /></div> : clients.length === 0 ? <p className="mt-2 text-sm text-navy/60">Nenhum cliente ainda.</p> : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {clients.map((c) => {
              const pending = c.contents.filter((x) => x.status === "aguardando").length;
              return (
                <li key={c.id}>
                  <Link to={`/admin/clientes/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-navy/5 hover:ring-sky/40">
                    <Avatar path={c.foto_perfil} name={c.nome_marca} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.nome_marca}</p>
                      <p className="truncate text-sm text-navy/60">@{c.instagram}</p>
                      <p className="truncate text-xs text-navy/40">{emails[c.user_id]}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${pending ? "bg-amber-100 text-amber-800" : "bg-paper text-navy/50"}`}>{pending} pendente{pending === 1 ? "" : "s"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppLayout>
  );
}
