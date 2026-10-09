"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { ReportView } from "@/components/ReportView";
import { ManualDataForm } from "@/components/ManualDataForm";
import { PdfExportButton } from "@/components/PdfExportButton";
import { DiagnosticReport, InstagramProfileData } from "@/lib/types";

type Phase = "input" | "manual" | "result";
type LoadingStage = "idle" | "profile" | "generating";

const DEMO_MARKER = "\u0001DEMO\u0001";
const REAL_MARKER = "\u0001REAL\u0001";
const ERROR_MARKER = "\u0001ERROR\u0001";
// Must match SCORES_TAG / BIO_TAG / GAPS_SWOT_TAG / POSITIONING_TAG /
// TACTICS_TAG in lib/claude.ts — the report is generated as five parallel
// AI calls (to stay under Vercel's 60s function limit without losing
// depth) and their chunks arrive interleaved, tagged with these control
// characters so they can be split back into five bodies.
const PART_TAGS = ["\u0002", "\u0003", "\u0004", "\u0005", "\u0006"];

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [stage, setStage] = useState<LoadingStage>("idle");
  const [progress, setProgress] = useState(0);
  const [username, setUsername] = useState("");
  const [prefill, setPrefill] = useState<Partial<InstagramProfileData> | undefined>(undefined);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const loading = stage !== "idle";

  async function resolveProfile(manualData?: Partial<InstagramProfileData>) {
    setStage("profile");
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramUrl: url, manualData }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Falha ao buscar o perfil.");
        setStage("idle");
        return;
      }

      if (data.needsManualData) {
        setUsername(data.username);
        setPrefill(data.prefill);
        setPhase("manual");
        setStage("idle");
        return;
      }

      await generateDiagnostic(data.profile as InstagramProfileData);
    } catch {
      setError("Erro de conexão ao buscar o perfil. Tente novamente.");
      setStage("idle");
    }
  }

  async function generateDiagnostic(profile: InstagramProfileData) {
    setStage("generating");
    setProgress(0);
    setError("");
    try {
      const res = await fetch("/api/generate-diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });

      if (!res.ok || !res.body) {
        setError("Falha ao gerar o diagnóstico. Tente novamente.");
        setStage("idle");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setProgress(text.length);
      }

      if (text.includes(ERROR_MARKER)) {
        const message = text.split(ERROR_MARKER)[1] || "Falha ao gerar o diagnóstico.";
        setError(message);
        setStage("idle");
        return;
      }

      const isDemo = text.startsWith(DEMO_MARKER);
      const body = isDemo
        ? text.slice(DEMO_MARKER.length)
        : text.startsWith(REAL_MARKER)
        ? text.slice(REAL_MARKER.length)
        : text;

      // Parsed separately from the fetch/stream-reading above: a malformed
      // or truncated JSON here is a bad AI response, not a dropped
      // connection, and deserves its own clearer message instead of being
      // caught by the generic network-error handler below.
      let diagnostic: any;
      try {
        if (isDemo) {
          const jsonMatch = body.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("no json");
          diagnostic = JSON.parse(jsonMatch[0]);
        } else {
          // Real reports arrive as four interleaved, tagged parts (see
          // streamDiagnosticParts in lib/claude.ts) — split back into four
          // bodies by which tag last preceded each character, then parse
          // and merge them (their top-level keys are disjoint by design).
          // Each part's text is already a complete, validated, correctly-
          // shaped JSON object by the time it's sent (lib/claude.ts
          // normalizes and retries malformed tool-use output server-side),
          // so no repair or regex extraction is needed here.
          const texts: Record<string, string> = Object.fromEntries(PART_TAGS.map((t) => [t, ""]));
          let current = "";
          for (const ch of body) {
            if (PART_TAGS.includes(ch)) current = ch;
            else if (current) texts[current] += ch;
          }
          const parsed = Object.values(texts).map((t) => JSON.parse(t));
          diagnostic = Object.assign({}, ...parsed);
        }
      } catch {
        setError("A resposta da IA veio incompleta ou inválida. Tente novamente.");
        setStage("idle");
        return;
      }

      const followers = profile.followers || 1;
      const engagementRate =
        profile.avgLikes && profile.avgComments
          ? Number((((profile.avgLikes + profile.avgComments) / followers) * 100).toFixed(2))
          : diagnostic.engagement?.rate ?? 0;

      setReport({
        ...diagnostic,
        profile: {
          username: profile.username,
          fullName: profile.fullName,
          profilePicUrl: profile.profilePicUrl,
          followers: profile.followers,
          following: profile.following,
          posts: profile.posts,
          isVerified: profile.isVerified,
          engagementRate,
        },
        generatedAt: new Date().toISOString(),
        dataSource: isDemo ? "demo" : profile.source,
      });
      setPhase("result");
      setStage("idle");
    } catch {
      setError("Erro de conexão ao gerar o diagnóstico. Tente novamente.");
      setStage("idle");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    resolveProfile();
  }

  function reset() {
    setPhase("input");
    setReport(null);
    setUrl("");
    setError("");
    setStage("idle");
    setProgress(0);
    setPrefill(undefined);
  }

  const loadingLabel =
    stage === "profile"
      ? "Buscando dados do perfil..."
      : stage === "generating"
      ? `Gerando diagnóstico${progress > 400 ? ` (${Math.min(99, Math.round((progress / 6000) * 100))}%)` : "..."}`
      : "";

  return (
    <main className="min-h-screen px-5 sm:px-6">
      <header className="no-print max-w-report mx-auto flex items-center justify-between flex-wrap gap-2 py-6">
        <Logo />
        {phase === "result" && report && (
          <div className="flex items-center gap-5">
            <PdfExportButton report={report} filename={`diagnostico-${report.profile.username}.pdf`} />
            <button onClick={reset} className="text-[13px] font-medium text-river-ink3 hover:text-river-ink transition">
              Nova análise
            </button>
          </div>
        )}
      </header>

      <div className="py-6">
        {phase !== "result" && (
          <div className="max-w-report mx-auto mb-12">
            <h1 className="text-[28px] sm:text-[34px] font-bold text-river-ink leading-tight tracking-tight">
              Diagnóstico de perfil <span className="text-river-accent">Instagram</span>
            </h1>
            <p className="text-river-ink2 mt-3 text-[14px] leading-relaxed max-w-md">
              Cole o link de um perfil do Instagram e receba um diagnóstico completo de posicionamento, conteúdo,
              engajamento e estratégia.
            </p>
          </div>
        )}

        {phase === "input" && (
          <div className="max-w-report mx-auto">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-4 bg-white border border-river-line rounded-xl px-5 py-1.5 shadow-[0_1px_2px_rgba(18,24,43,.04),0_10px_24px_-14px_rgba(18,24,43,.14)]"
            >
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="instagram.com/seuusuario ou @seuusuario"
                className="flex-1 text-[15px] outline-none bg-transparent text-river-ink placeholder:text-river-ink3 py-3"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="text-[13.5px] font-semibold text-river-accent hover:text-river-accentDeep transition disabled:opacity-40 shrink-0"
              >
                {loading ? "Analisando..." : "Analisar →"}
              </button>
            </form>

            {loading && <div className="mt-6 text-[13.5px] text-river-ink3">{loadingLabel}</div>}

            {error && <div className="mt-6 text-[13.5px] text-river-danger">{error}</div>}
          </div>
        )}

        {phase === "manual" && (
          <div>
            <ManualDataForm username={username} prefill={prefill} loading={loading} onSubmit={(data) => resolveProfile(data)} />
            {loading && (
              <div className="max-w-report mx-auto mt-4 text-[13.5px] text-river-ink3">{loadingLabel}</div>
            )}
            {error && <div className="max-w-report mx-auto mt-4 text-[13.5px] text-river-danger">{error}</div>}
          </div>
        )}

        {phase === "result" && report && <ReportView report={report} id="report-root" />}
      </div>

      <footer className="no-print max-w-report mx-auto text-center text-[11px] text-river-ink3 py-10">
        River Agency · Ferramenta de Diagnóstico de Perfil
      </footer>
    </main>
  );
}
