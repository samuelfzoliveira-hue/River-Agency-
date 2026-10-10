import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../auth/AuthContext";
import AuthShell, { Feedback } from "../components/AuthShell";
import { supabase } from "../lib/supabase";

export default function ChangePassword() {
  const { role, mustChangePassword, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("A nova senha deve ter ao menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setBusy(false); return setError("Não foi possível salvar. Escolha uma senha diferente da provisória."); }
    await supabase.rpc("complete_password_change");
    await refreshProfile();
    navigate(homeFor(role), { replace: true });
  };

  return (
    <AuthShell title="Crie sua senha" subtitle={mustChangePassword ? "Por segurança, troque a senha provisória antes de continuar." : "Escolha uma nova senha."}>
      <form onSubmit={submit} className="space-y-4">
        <input className="field" type="password" required autoComplete="new-password" placeholder="Nova senha (mín. 8 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="field" type="password" required autoComplete="new-password" placeholder="Repita a nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <Feedback kind="error">{error}</Feedback>}
        <button className="btn" disabled={busy}>{busy ? "Salvando…" : "Salvar senha"}</button>
        <p className="text-center text-sm"><button type="button" onClick={signOut} className="link">Sair</button></p>
      </form>
    </AuthShell>
  );
}
