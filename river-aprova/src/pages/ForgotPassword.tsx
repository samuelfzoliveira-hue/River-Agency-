import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthShell, { Feedback } from "../components/AuthShell";
import { supabase } from "../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) setError("Não foi possível enviar o e-mail agora. Tente novamente.");
    else setSent(true);
    setBusy(false);
  };

  return (
    <AuthShell title="Esqueci minha senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      {sent ? (
        <Feedback kind="ok">Se o e-mail estiver cadastrado, você receberá o link em instantes.</Feedback>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input className="field" type="email" required autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <Feedback kind="error">{error}</Feedback>}
          <button className="btn" disabled={busy}>{busy ? "Enviando…" : "Enviar link"}</button>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link className="link" to="/login">Voltar ao login</Link></p>
    </AuthShell>
  );
}
