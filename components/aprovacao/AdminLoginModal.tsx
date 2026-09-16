"use client";

import { useState } from "react";
import { Modal } from "./Modal";

export function AdminLoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/aprovacao/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onSuccess(password);
        return;
      }
      setError("Senha incorreta.");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} contentClassName="w-full max-w-xs rounded-2xl bg-white shadow-2xl overflow-hidden">
      <form onSubmit={handleSubmit} className="p-6">
        <h2 className="mb-1 text-[15px] font-bold text-river-ink">Modo Agência</h2>
        <p className="mb-4 text-[12.5px] text-river-ink3">
          Digite a senha da equipe para publicar e gerenciar conteúdo.
        </p>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="w-full rounded-lg border border-river-line px-3 py-2.5 text-[13.5px] text-river-ink outline-none placeholder:text-river-ink3 focus:border-river-accent"
        />
        {error && <p className="mt-2 text-[12px] text-river-bad">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={loading || !password}
            className="flex-1 rounded-lg bg-river-accent px-3 py-2.5 text-[13px] font-semibold text-white transition hover:bg-river-accentDeep disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-river-line px-3 py-2.5 text-[13px] font-medium text-river-ink3 transition hover:text-river-ink"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
