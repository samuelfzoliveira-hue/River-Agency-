import { useCallback, useEffect, useState, type FormEvent } from "react";
import AppLayout from "../components/AppLayout";
import { Feedback } from "../components/AuthShell";
import { supabase } from "../lib/supabase";

interface Client {
  id: string;
  email: string;
  created_at: string;
}

export default function Admin() {
  const [clients, setClients] = useState<Client[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id,email,created_at")
      .eq("role", "cliente")
      .order("created_at", { ascending: false });
    setClients((data as Client[] | null) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/create-client", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "error", text: json.error ?? "Não foi possível criar a conta." });
      } else {
        setMsg({ kind: "ok", text: `Conta criada para ${json.email}. Envie a senha ao cliente.` });
        setEmail("");
        setPassword("");
        load();
      }
    } catch {
      setMsg({ kind: "error", text: "Falha de conexão. Tente novamente." });
    }
    setBusy(false);
  };

  return (
    <AppLayout title="Clientes">
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy/5 sm:p-6">
        <h2 className="text-lg font-semibold">Novo cliente</h2>
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input className="field" type="email" required placeholder="E-mail do cliente" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="field" type="text" required minLength={6} autoComplete="off" placeholder="Senha inicial (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn sm:w-auto" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</button>
        </form>
        {msg && <div className="mt-3"><Feedback kind={msg.kind}>{msg.text}</Feedback></div>}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Contas de clientes ({clients.length})</h2>
        {clients.length === 0 ? (
          <p className="mt-3 text-sm text-navy/60">Nenhum cliente ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-navy/10 rounded-2xl bg-white ring-1 ring-navy/5">
            {clients.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="truncate font-medium">{c.email}</span>
                <span className="shrink-0 text-navy/50">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppLayout>
  );
}
