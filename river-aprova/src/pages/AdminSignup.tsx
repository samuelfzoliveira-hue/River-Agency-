import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthShell, { Feedback } from "../components/AuthShell";
import { ADMIN_EMAIL, supabase } from "../lib/supabase";

// Rota não linkada em nenhuma tela. A restrição real fica no banco (trigger restrict_signup).
export default function AdminSignup() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
      setError("Cadastro não permitido. Solicite acesso à River Agency.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) setError("Não foi possível criar a conta. Se ela já existe, use o login.");
    else setDone(true);
  };

  return (
    <AuthShell title="Primeiro acesso" subtitle="Criação da conta de administrador.">
      {done ? (
        <Feedback kind="ok">Conta criada. Confirme o e-mail, se solicitado, e entre pelo login.</Feedback>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input className="field" type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="field" type="password" required minLength={6} autoComplete="new-password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Feedback kind="error">{error}</Feedback>}
          <button className="btn" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</button>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link className="link" to="/login">Ir para o login</Link></p>
    </AuthShell>
  );
}
