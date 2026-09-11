"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { ReportView } from "@/components/ReportView";
import { ManualDataForm } from "@/components/ManualDataForm";
import { PdfExportButton } from "@/components/PdfExportButton";
import { IconInstagram } from "@/components/icons";
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
    <main className="min-h-screen">
      <header className="no-print border-b border-river-sky bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo />
          {phase === "result" && report && (
            <div className="flex items-center gap-2">
              <PdfExportButton
                targetId="report-root"
                filename={`diagnostico-${report.profile.username}.pdf`}
              />
              <button
                onClick={reset}
                className="text-sm font-semibold text-river-navy/60 hover:text-river-navy px-3 py-2"
              >
                Nova análise
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-10">
        {phase !== "result" && (
          <div className="max-w-xl mx-auto text-center mb-10">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-river-navy leading-tight">
              Diagnóstico de Perfil <span className="text-river-primary">Instagram</span>
            </h1>
            <p className="text-river-navy/60 mt-3 text-sm sm:text-base">
              Cole o link (ou @usuário) de um perfil do Instagram e receba, em minutos, um
              diagnóstico completo de posicionamento, conteúdo, engajamento, arquétipo de marca e
              estratégia — feito pela River Agency.
            </p>
          </div>
        )}

        {phase === "input" && (
          <>
            <form
              onSubmit={handleSubmit}
              className="max-w-xl mx-auto bg-white rounded-xl2 shadow-card border border-river-sky p-3 flex items-center gap-2"
            >
              <span className="pl-3 text-river-primary">
                <IconInstagram />
              </span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="instagram.com/seuusuario ou @seuusuario"
                className="flex-1 py-3 text-sm outline-none bg-transparent text-river-navy placeholder:text-river-navy/35"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="rounded-lg bg-river-primary text-white font-semibold text-sm px-5 py-3 hover:bg-river-blue transition disabled:opacity-50 shrink-0"
              >
                {loading ? "Analisando..." : "Analisar perfil"}
              </button>
            </form>

            {loading && (
              <div className="max-w-xl mx-auto mt-6 text-center text-sm text-river-navy/50">
                Coletando dados públicos e gerando o diagnóstico estratégico completo...
              </div>
            )}

            {error && (
              <div className="max-w-xl mx-auto mt-6 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-4 text-center">
                {error}
              </div>
            )}
          </>
        )}

        {phase === "manual" && (
          <div className="max-w-xl mx-auto mt-2">
            <ManualDataForm username={username} loading={loading} onSubmit={(data) => runAnalysis(data)} />
            {error && (
              <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-4 text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {phase === "result" && report && <ReportView report={report} id="report-root" />}
      </div>

      <footer className="no-print text-center text-xs text-river-navy/35 pb-8">
        River Agency · Ferramenta de Diagnóstico de Perfil (metodologia PMM)
      </footer>
    </main>
  );
}
