import { DiagnosticReport } from "@/lib/types";
import { Section } from "./Section";
import { ScoreRing } from "./ScoreRing";
import { ProgressBar } from "./ProgressBar";
import { SwotGrid } from "./SwotGrid";

function formatFollowers(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-xl font-bold tabular-nums ${accent ? "text-river-accent" : "text-river-ink"}`}>
        {value}
      </div>
      <div className="text-[11px] text-river-ink3 mt-0.5">{label}</div>
    </div>
  );
}

const TONES = {
  good: { bg: "bg-river-goodSoft", line: "border-river-goodLine", text: "text-river-good", dot: "bg-river-good" },
  bad: { bg: "bg-river-badSoft", line: "border-river-badLine", text: "text-river-bad", dot: "bg-river-bad" },
  accent: { bg: "bg-river-accentSoft", line: "border-blue-200", text: "text-river-accentDeep", dot: "bg-river-accent" },
  neutral: { bg: "bg-river-canvas", line: "border-river-line", text: "text-river-ink3", dot: "bg-river-ink3" },
} as const;

function Box({ tone, label, children }: { tone: keyof typeof TONES; label: string; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div className={`rounded-xl border ${t.line} ${t.bg} p-5`}>
      <div className={`text-[11px] font-bold tracking-[0.08em] uppercase mb-3 ${t.text}`}>{label}</div>
      {children}
    </div>
  );
}

function ToneList({ tone, items }: { tone: keyof typeof TONES; items: string[] }) {
  const t = TONES[tone];
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="text-[13.5px] leading-relaxed text-river-ink flex gap-2.5">
          <span className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-river-ink3 mb-2.5">{children}</div>;
}

export function ReportView({ report, id }: { report: DiagnosticReport; id?: string }) {
  const { profile } = report;

  return (
    <div id={id} className="max-w-report mx-auto pb-24">
      {/* Profile header */}
      <div className="pb-8">
        <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-river-ink3 mb-4">
          Relatório de Análise
        </div>
        <div className="flex items-center gap-4">
          {profile.profilePicUrl ? (
            <img src={profile.profilePicUrl} alt={profile.username} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white border border-river-line flex items-center justify-center font-bold text-river-ink2">
              {profile.username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-xl font-bold text-river-ink">@{profile.username}</div>
            <div className="text-[13px] text-river-ink2">{profile.fullName}</div>
          </div>
        </div>
        <div className="flex gap-6 sm:gap-10 mt-7 flex-wrap">
          <Stat label="seguidores" value={formatFollowers(profile.followers)} />
          <Stat label="engajamento" value={`${profile.engagementRate?.toFixed(2)}%`} accent />
        </div>
      </div>

      {report.dataSource === "demo" && (
        <div className="no-print text-[13px] text-river-ink2 bg-white border border-river-line rounded-lg p-4 mb-8">
          Este é um relatório de <strong className="text-river-ink">demonstração</strong>. Configure a variável de
          ambiente <code className="text-river-accent">ANTHROPIC_API_KEY</code> para gerar diagnósticos reais a
          partir de qualquer perfil.
        </div>
      )}

      <div className="space-y-8">
        {/* Score — elevated: the headline number */}
        <Section title="Score Geral do Perfil" elevated>
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <ScoreRing score={report.overallScore} />
            <div className="flex-1 w-full">
              {report.scoreBreakdown.map((s) => (
                <ProgressBar key={s.label} label={s.label} score={s.score} compact />
              ))}
            </div>
          </div>
          <p className="mt-6 text-[13.5px] leading-relaxed text-river-ink2">{report.overallSummary}</p>
        </Section>

        {/* Evolution */}
        <Section title="Projeção de Evolução do Perfil">
          <ProgressBar label="Atual" score={report.evolution.current} semantic={false} />
          <div className="mt-2 space-y-6">
            {report.evolution.phases.map((phase, i) => (
              <div key={phase.name} className="flex gap-4">
                <span className="text-[12px] font-semibold text-river-accent tabular-nums pt-0.5 w-4 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="text-[13.5px] font-semibold text-river-ink">{phase.name}</h3>
                    <span className="text-[12px] text-river-ink3 tabular-nums">{Math.round(phase.score)}</span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-river-ink2">{phase.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Bio */}
        <Section title="Diagnóstico de Bio e Perfil">
          <ProgressBar label="Score de alinhamento" score={report.bioDiagnosis.alignmentScore} />
          <div className="border-l-2 border-river-accentSoft pl-4 my-5">
            <p className="text-[13.5px] italic text-river-ink2">&ldquo;{report.bioDiagnosis.currentBio}&rdquo;</p>
          </div>
          <p className="text-[13.5px] leading-relaxed text-river-ink2 mb-5">{report.bioDiagnosis.analysis}</p>

          <div className="grid grid-cols-1 gap-4">
            <Box tone="bad" label="Problemas identificados">
              <ToneList tone="bad" items={report.bioDiagnosis.problems} />
            </Box>
            <Box tone="good" label="Estrutura da bio ideal">
              <div className="space-y-2 text-[13.5px]">
                <p><span className="text-river-ink3">Promessa — </span>{report.bioDiagnosis.idealBio.promise}</p>
                <p><span className="text-river-ink3">Autoridade — </span>{report.bioDiagnosis.idealBio.authority}</p>
                <p><span className="text-river-ink3">CTA — </span>{report.bioDiagnosis.idealBio.cta}</p>
              </div>
            </Box>
          </div>
        </Section>

        {/* Engagement */}
        <Section title="Análise de Engajamento">
          <div className="flex gap-6 sm:gap-10 mb-6 flex-wrap">
            <Stat label="sua taxa" value={`${report.engagement.rate.toFixed(2)}%`} accent />
            <Stat label="média de mercado" value={`${report.engagement.marketAverage.toFixed(1)}%`} />
            <Stat label="curtidas/post" value={String(report.engagement.avgLikes)} />
            <Stat label="comentários/post" value={String(report.engagement.avgComments)} />
          </div>
          <p className="text-[13.5px] leading-relaxed text-river-ink2">{report.engagement.analysis}</p>
        </Section>

        {/* Gaps */}
        <Section title="Gaps Identificados">
          <div className="space-y-3">
            {report.gaps.map((g) => (
              <div key={g.title} className="border-l-2 border-river-badLine pl-4 py-0.5">
                <h3 className="text-[13.5px] font-semibold text-river-ink mb-1">{g.title}</h3>
                <p className="text-[13.5px] leading-relaxed text-river-ink2">{g.description}</p>
              </div>
            ))}
          </div>
          {report.identityCrisisNote && (
            <p className="mt-6 text-[13.5px] leading-relaxed text-river-ink2">{report.identityCrisisNote}</p>
          )}
        </Section>

        {/* SWOT */}
        <Section title="Análise SWOT">
          <SwotGrid swot={report.swot} />
        </Section>

        {/* Market positioning */}
        <Section title="Posicionamento de Mercado">
          <p className="text-[13.5px] leading-relaxed text-river-ink2 mb-5">{report.marketPositioning.summary}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Box tone="good" label="Vantagens únicas">
              <ToneList tone="good" items={report.marketPositioning.uniqueAdvantages} />
            </Box>
            <Box tone="bad" label="Gaps a preencher">
              <ToneList tone="bad" items={report.marketPositioning.gapsToFill} />
            </Box>
          </div>
        </Section>

        {/* Archetypes */}
        <Section title="Posicionamento / Arquétipo">
          <div className="space-y-6">
            {report.archetypes.map((a) => (
              <div key={a.name} className="border-l-2 border-river-accent pl-4">
                <p className="text-[14px] font-bold text-river-ink">
                  {a.name} <span className="font-normal text-river-ink3">({a.subtitle})</span>
                </p>
                <p className="text-[13.5px] text-river-ink2 mt-2 leading-relaxed">
                  <span className="text-river-ink3">O que é — </span>{a.whatItIs}
                </p>
                <p className="text-[13.5px] text-river-ink2 mt-1 leading-relaxed">
                  <span className="text-river-ink3">No perfil — </span>{a.inProfile}
                </p>
                <p className="text-[13.5px] text-river-ink2 mt-1 leading-relaxed">
                  <span className="text-river-ink3">Pra você — </span>{a.whatItMeansForYou}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* Persona */}
        <Section title="Análise de Persona / Avatar">
          <Label>Avatar ideal</Label>
          <p className="text-[13.5px] leading-relaxed text-river-ink2 mb-6">{report.persona.idealAvatar}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <Box tone="neutral" label="Dor">
              <p className="text-[13.5px] leading-relaxed text-river-ink">{report.persona.pain}</p>
            </Box>
            <Box tone="accent" label="Desejo">
              <p className="text-[13.5px] leading-relaxed text-river-ink">{report.persona.desire}</p>
            </Box>
          </div>
          <p className="text-[13.5px] leading-relaxed text-river-ink2 mb-5">{report.persona.contentAlignment}</p>
          <Box tone="accent" label="Recomendações">
            <ToneList tone="accent" items={report.persona.recommendations} />
          </Box>
        </Section>

        {/* Success formula */}
        <Section title="Fórmula do Sucesso">
          <Label>Melhores formatos</Label>
          <ul className="space-y-2.5 mb-6">
            {report.successFormula.bestFormats.map((f, i) => (
              <li key={i} className="text-[13.5px] leading-relaxed text-river-ink flex gap-2.5">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 bg-river-accent" />
                {f}
              </li>
            ))}
          </ul>
          <Label>Pilares de conteúdo</Label>
          <div className="space-y-2 text-[13.5px] mb-6">
            {report.successFormula.contentPillars.map((p) => (
              <p key={p.name}>
                <span className="font-semibold text-river-ink">{p.name} — </span>
                <span className="text-river-ink2">{p.description}</span>
              </p>
            ))}
          </div>
          <Label>Frequência recomendada</Label>
          <p className="text-[13.5px] leading-relaxed text-river-ink2">{report.successFormula.postingFrequency}</p>
        </Section>

        {/* Best times */}
        <Section title="Melhores Horários para Postar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Box tone="accent" label="Dias úteis">
              <div className="space-y-1.5 text-[13.5px] text-river-ink tabular-nums">
                {report.bestTimes.weekdays.map((t, i) => <p key={i}>{t}</p>)}
              </div>
            </Box>
            <Box tone="accent" label="Fins de semana">
              <div className="space-y-1.5 text-[13.5px] text-river-ink tabular-nums">
                {report.bestTimes.weekends.map((t, i) => <p key={i}>{t}</p>)}
              </div>
            </Box>
          </div>
        </Section>

        {/* Trends */}
        <Section title="Tendências de Mercado">
          <ul className="space-y-2.5">
            {report.marketTrends.map((t, i) => (
              <li key={i} className="text-[13.5px] leading-relaxed text-river-ink flex gap-2.5">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 bg-river-ink3" />
                {t}
              </li>
            ))}
          </ul>
        </Section>

        {/* Final recommendations — elevated: the action items */}
        <Section title="Recomendações Finais" elevated>
          <ol className="space-y-4">
            {report.finalRecommendations.map((r, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-river-ink">
                <span className="font-bold text-river-accent tabular-nums shrink-0">{i + 1}.</span>
                {r}
              </li>
            ))}
          </ol>
        </Section>

        {/* Summary */}
        <Section title="Resumo de Forças e Fraquezas">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <Box tone="good" label="Principal força">
              <p className="text-[13.5px] leading-relaxed text-river-ink">{report.summary.mainStrength}</p>
            </Box>
            <Box tone="bad" label="Principal fraqueza">
              <p className="text-[13.5px] leading-relaxed text-river-ink">{report.summary.mainWeakness}</p>
            </Box>
          </div>
          <Box tone="accent" label="Oportunidades identificadas">
            <ToneList tone="accent" items={report.summary.opportunities} />
          </Box>
        </Section>
      </div>

      <div className="text-center text-[11px] text-river-ink3 pt-14">
        Gerado por River Agency ·{" "}
        {new Date(report.generatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}
