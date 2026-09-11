"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { ReportView } from "@/components/ReportView";
import { ManualDataForm } from "@/components/ManualDataForm";
import { PdfExportButton } from "@/components/PdfExportButton";
import { DiagnosticReport, InstagramProfileData } from "@/lib/types";

type Phase = "input" | "manual" | "result";

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  async function runAnalysis(manualData?: Partial<InstagramProfileData>) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramUrl: url, manualData }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Falha ao gerar diagnóstico.");
        setLoading(false);
        return;
      }

      if (data.needsManualData) {
        setUsername(data.username);
        setPhase("manual");
        setLoading(false);
        return;
      }

      setReport(data as DiagnosticReport);
      setPhase("result");
      setLoading(false);
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    runAnalysis();
  }

  function reset() {
    setPhase("input");
    setReport(null);
    setUrl("");
    setError("");
    setLoading(false);
  }

  return (
    <main className="min-h-screen px-5 sm:px-6">
      <header className="no-print max-w-report mx-auto flex items-center justify-between py-6">
        <Logo />
        {phase === "result" && report && (
          <div className="flex items-center gap-5">
            <PdfExportButton targetId="report-root" filename={`diagnostico-${report.profile.username}.pdf`} />
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
            <form onSubmit={handleSubmit} className="flex items-end gap-4 border-b border-river-line pb-3">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="instagram.com/seuusuario ou @seuusuario"
                className="flex-1 text-[15px] outline-none bg-transparent text-river-ink placeholder:text-river-ink3 py-2"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="text-[13.5px] font-semibold text-river-accent hover:text-river-accentDeep transition disabled:opacity-40 shrink-0 pb-2"
              >
                {loading ? "Analisando..." : "Analisar →"}
              </button>
            </form>

            {loading && (
              <div className="mt-6 text-[13.5px] text-river-ink3">
                Coletando dados públicos e gerando o diagnóstico completo...
              </div>
            )}

            {error && <div className="mt-6 text-[13.5px] text-river-danger">{error}</div>}
          </div>
        )}

        {phase === "manual" && (
          <div>
            <ManualDataForm username={username} loading={loading} onSubmit={(data) => runAnalysis(data)} />
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
