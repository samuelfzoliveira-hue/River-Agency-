"use client";

import { useState } from "react";
import { InstagramProfileData } from "@/lib/types";

export function ManualDataForm({
  username,
  onSubmit,
  loading,
}: {
  username: string;
  onSubmit: (data: Partial<InstagramProfileData>) => void;
  loading: boolean;
}) {
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [followers, setFollowers] = useState("");
  const [posts, setPosts] = useState("");
  const [avgLikes, setAvgLikes] = useState("");
  const [avgComments, setAvgComments] = useState("");
  const [captions, setCaptions] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      username,
      fullName: fullName || username,
      bio,
      followers: Number(followers) || 0,
      posts: Number(posts) || 0,
      avgLikes: Number(avgLikes) || undefined,
      avgComments: Number(avgComments) || undefined,
      recentCaptions: captions
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl2 shadow-card border border-river-sky p-6 sm:p-8 space-y-4"
    >
      <p className="text-sm text-river-navy/70 leading-relaxed">
        Não conseguimos coletar os dados de <strong>@{username}</strong> automaticamente — o
        Instagram costuma bloquear acessos automatizados a partir de servidores. Preencha os
        dados públicos do perfil abaixo (copiando do próprio Instagram) para gerar o diagnóstico
        completo.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome de exibição">
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex: Samuel Ferraz"
          />
        </Field>
        <Field label="Seguidores">
          <input
            className="input"
            type="number"
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
            placeholder="Ex: 2700"
          />
        </Field>
        <Field label="Curtidas médias por post">
          <input
            className="input"
            type="number"
            value={avgLikes}
            onChange={(e) => setAvgLikes(e.target.value)}
            placeholder="Ex: 90"
          />
        </Field>
        <Field label="Comentários médios por post">
          <input
            className="input"
            type="number"
            value={avgComments}
            onChange={(e) => setAvgComments(e.target.value)}
            placeholder="Ex: 7"
          />
        </Field>
      </div>

      <Field label="Bio atual (copie exatamente)">
        <textarea
          className="input min-h-[70px]"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Cole a bio do perfil aqui..."
        />
      </Field>

      <Field label="Legendas de posts recentes (uma por linha, quanto mais melhor)">
        <textarea
          className="input min-h-[110px]"
          value={captions}
          onChange={(e) => setCaptions(e.target.value)}
          placeholder={"Cole aqui algumas legendas recentes, uma por linha..."}
        />
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-river-primary text-white font-semibold py-3 hover:bg-river-blue transition disabled:opacity-60"
      >
        {loading ? "Gerando diagnóstico..." : "Gerar diagnóstico completo"}
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #dce6fb;
          border-radius: 0.5rem;
          padding: 0.6rem 0.75rem;
          font-size: 0.875rem;
          color: #0b1f3a;
          background: #fafbff;
        }
        .input:focus {
          outline: none;
          border-color: #1d63e8;
          box-shadow: 0 0 0 3px rgba(29, 99, 232, 0.12);
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-river-navy/70 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
