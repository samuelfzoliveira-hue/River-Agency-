import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthShell, { Feedback } from "../components/AuthShell";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError("E-mail ou senha incorretos.");
    setBusy(false); // o redirecionamento é feito pelo PublicOnly ao detectar a sessão
  };

  return (
    <AuthShell title="Entrar" subtitle="Acesse para aprovar seus conteúdos.">
      <form onSubmit={submit} className="space-y-4">
        <input className="field" type="email" required autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="field" type="password" required autoComplete="current-password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <Feedback kind="error">{error}</Feedback>}
        <button className="btn" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        <p className="text-center text-sm"><Link className="link" to="/esqueci-senha">Esqueci minha senha</Link></p>
      </form>
    </AuthShell>
  );
}
