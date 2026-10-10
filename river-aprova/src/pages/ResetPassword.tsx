import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell, { Feedback } from "../components/AuthShell";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // O link do e-mail cria uma sessão de recuperação; só então a senha pode ser trocada.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError("Não foi possível salvar a senha. Use ao menos 6 caracteres ou peça um novo link.");
    else navigate("/login", { replace: true });
  };

  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma nova senha para sua conta.">
      {ready ? (
        <form onSubmit={submit} className="space-y-4">
          <input className="field" type="password" required minLength={6} autoComplete="new-password" placeholder="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Feedback kind="error">{error}</Feedback>}
          <button className="btn" disabled={busy}>{busy ? "Salvando…" : "Salvar senha"}</button>
        </form>
      ) : (
        <Feedback kind="error">Link inválido ou expirado. <Link className="link" to="/esqueci-senha">Solicitar novo link</Link></Feedback>
      )}
    </AuthShell>
  );
}
