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
      recentCaptions: captions.split("\n").map((l) => l.trim()).filter(Boolean),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-report mx-auto">
      <p className="text-[13.5px] leading-relaxed text-river-ink2 mb-8">
        Não conseguimos coletar os dados de <strong className="text-river-ink">@{username}</strong>{" "}
        automaticamente — o Instagram costuma bloquear acessos automatizados a partir de servidores. Preencha os
        dados públicos do perfil abaixo para gerar o diagnóstico completo.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <Field label="Nome de exibição">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Ana Souza" />
        </Field>
        <Field label="Seguidores">
          <input type="number" value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="Ex: 2700" />
        </Field>
        <Field label="Curtidas médias por post">
          <input type="number" value={avgLikes} onChange={(e) => setAvgLikes(e.target.value)} placeholder="Ex: 90" />
        </Field>
        <Field label="Comentários médios por post">
          <input type="number" value={avgComments} onChange={(e) => setAvgComments(e.target.value)} placeholder="Ex: 7" />
        </Field>
      </div>

      <Field label="Bio atual (copie exatamente)">
        <textarea className="min-h-[64px]" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Cole a bio do perfil aqui..." />
      </Field>

      <Field label="Legendas de posts recentes (uma por linha)">
        <textarea
          className="min-h-[100px]"
          value={captions}
          onChange={(e) => setCaptions(e.target.value)}
          placeholder="Cole aqui algumas legendas recentes, uma por linha..."
        />
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-river-ink text-white text-[13.5px] font-semibold py-3 mt-2 hover:bg-river-accent transition disabled:opacity-50"
      >
        {loading ? "Gerando diagnóstico..." : "Gerar diagnóstico completo"}
      </button>

      <style jsx>{`
        input,
        textarea {
          width: 100%;
          border: none;
          border-bottom: 1px solid #e7e9f0;
          padding: 8px 0;
          font-size: 13.5px;
          color: #12182b;
          background: transparent;
          resize: vertical;
        }
        input::placeholder,
        textarea::placeholder {
          color: #9aa2b4;
        }
        input:focus,
        textarea:focus {
          outline: none;
          border-color: #1554f0;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-6">
      <span className="block text-[11px] font-semibold tracking-[0.06em] uppercase text-river-ink3 mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}
