"use client";

import { useState } from "react";
import { InstagramProfileData } from "@/lib/types";

type Prefill = Partial<Pick<InstagramProfileData, "fullName" | "followers" | "following" | "posts">>;

export function ManualDataForm({
  username,
  prefill,
  onSubmit,
  loading,
}: {
  username: string;
  prefill?: Prefill;
  onSubmit: (data: Partial<InstagramProfileData>) => void;
  loading: boolean;
}) {
  const [fullName, setFullName] = useState(prefill?.fullName || "");
  const [bio, setBio] = useState("");
  const [followers, setFollowers] = useState(prefill?.followers ? String(prefill.followers) : "");
  const [posts, setPosts] = useState(prefill?.posts ? String(prefill.posts) : "");
  const [avgLikes, setAvgLikes] = useState("");
  const [avgComments, setAvgComments] = useState("");
  const [captions, setCaptions] = useState("");

  const gotSomethingAutomatically = Boolean(prefill?.followers || prefill?.fullName);

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
    <form
      onSubmit={handleSubmit}
      className="max-w-report mx-auto bg-white border border-river-line rounded-2xl shadow-[0_1px_2px_rgba(18,24,43,.04),0_12px_28px_-14px_rgba(18,24,43,.14)] p-6 sm:p-7"
    >
      {gotSomethingAutomatically ? (
        <p className="text-[13.5px] leading-relaxed text-river-ink2 mb-8">
          Coletamos os números de <strong className="text-river-ink">@{username}</strong> automaticamente. O
          Instagram não libera a bio nem as legendas sem login — é só completar essas duas coisas abaixo.
        </p>
      ) : (
        <p className="text-[13.5px] leading-relaxed text-river-ink2 mb-8">
          Não conseguimos coletar os dados de <strong className="text-river-ink">@{username}</strong>{" "}
          automaticamente agora — o Instagram costuma bloquear acessos automatizados a partir de servidores.
          Preencha os dados públicos do perfil abaixo para gerar o diagnóstico completo.
        </p>
      )}

      <Field label="Bio atual (copie exatamente)">
        <textarea className="min-h-[64px]" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Cole a bio do perfil aqui..." autoFocus />
      </Field>

      <Field label="Legendas de posts recentes (uma por linha)">
        <textarea
          className="min-h-[100px]"
          value={captions}
          onChange={(e) => setCaptions(e.target.value)}
          placeholder="Cole aqui algumas legendas recentes, uma por linha..."
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <Field label={`Nome de exibição${prefill?.fullName ? " (coletado)" : ""}`}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Ana Souza" />
        </Field>
        <Field label={`Seguidores${prefill?.followers ? " (coletado)" : ""}`}>
          <input type="number" value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="Ex: 2700" />
        </Field>
        <Field label="Curtidas médias por post">
          <input type="number" value={avgLikes} onChange={(e) => setAvgLikes(e.target.value)} placeholder="Ex: 90" />
        </Field>
        <Field label="Comentários médios por post">
          <input type="number" value={avgComments} onChange={(e) => setAvgComments(e.target.value)} placeholder="Ex: 7" />
        </Field>
      </div>

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
