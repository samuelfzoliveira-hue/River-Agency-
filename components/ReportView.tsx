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

function Plain({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="text-[13.5px] leading-relaxed text-river-ink flex gap-2.5">
          <span className="mt-[7px] w-1 h-1 rounded-full bg-river-ink3 shrink-0" />
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
      <div className="pb-10">
        <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-river-ink3 mb-4">
          Relatório de Análise
        </div>
        <div className="flex items-center gap-4">
          {profile.profilePicUrl ? (
            <img src={profile.profilePicUrl} alt={profile.username} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full border border-river-line flex items-center justify-center font-bold text-river-ink2">
              {profile.username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-xl font-bold text-river-ink">@{profile.username}</div>
            <div className="text-[13px] text-river-ink2">{profile.fullName}</div>
          </div>
        </div>
        <div className="flex gap-10 mt-7">
          <Stat label="seguidores" value={formatFollowers(profile.followers)} />
          <Stat label="engajamento" value={`${profile.engagementRate?.toFixed(2)}%`} accent />
        </div>
      </div>

      {report.dataSource === "demo" && (
        <div className="no-print text-[13px] text-river-ink2 border border-river-line rounded-lg p-4 mb-10">
          Este é um relatório de <strong className="text-river-ink">demonstração</strong>. Configure a variável de
          ambiente <code className="text-river-accent">ANTHROPIC_API_KEY</code> para gerar diagnósticos reais a
          partir de qualquer perfil.
        </div>
      )}

      <div className="space-y-10">
        {/* Score */}
        <Section title="Score Geral do Perfil">
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
          <ProgressBar label="Atual" score={report.evolution.current} />
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
          <div className="border-l-2 border-river-line pl-4 my-5">
            <p className="text-[13.5px] italic text-river-ink2">&ldquo;{report.bioDiagnosis.currentBio}&rdquo;</p>
          </div>
          <p className="text-[13.5px] leading-relaxed text-river-ink2 mb-6">{report.bioDiagnosis.analysis}</p>

          <Label>Problemas identificados</Label>
          <Plain items={report.bioDiagnosis.problems} />

          <div className="border-t border-river-line mt-6 pt-6">
            <Label>Estrutura da bio ideal</Label>
            <div className="space-y-2 text-[13.5px]">
              <p><span className="text-river-ink3">Promessa — </span>{report.bioDiagnosis.idealBio.promise}</p>
              <p><span className="text-river-ink3">Autoridade — </span>{report.bioDiagnosis.idealBio.authority}</p>
              <p><span className="text-river-ink3">CTA — </span>{report.bioDiagnosis.idealBio.cta}</p>
            </div>
          </div>
        </Section>

        {/* Engagement */}
        <Section title="Análise de Engajamento">
          <div className="flex gap-10 mb-6">
            <Stat label="sua taxa" value={`${report.engagement.rate.toFixed(2)}%`} accent />
            <Stat label="média de mercado" value={`${report.engagement.marketAverage.toFixed(1)}%`} />
            <Stat label="curtidas/post" value={String(report.engagement.avgLikes)} />
            <Stat label="comentários/post" value={String(report.engagement.avgComments)} />
          </div>
          <p className="text-[13.5px] leading-relaxed text-river-ink2">{report.engagement.analysis}</p>
        </Section>

        {/* Gaps */}
        <Section title="Gaps Identificados">
          <div className="divide-y divide-river-line">
            {report.gaps.map((g) => (
              <div key={g.title} className="py-4 first:pt-0">
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
          <p className="text-[13.5px] leading-relaxed text-river-ink2 mb-6">{report.marketPositioning.summary}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <Label>Vantagens únicas</Label>
              <Plain items={report.marketPositioning.uniqueAdvantages} />
            </div>
            <div>
              <Label>Gaps a preencher</Label>
              <Plain items={report.marketPositioning.gapsToFill} />
            </div>
          </div>
        </Section>

        {/* Archetypes */}
        <Section title="Posicionamento / Arquétipo">
          <div className="space-y-6">
            {report.archetypes.map((a) => (
              <div key={a.name}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-6">
            <div>
              <Label>Dor</Label>
              <p className="text-[13.5px] leading-relaxed text-river-ink2">{report.persona.pain}</p>
            </div>
            <div>
              <Label>Desejo</Label>
              <p className="text-[13.5px] leading-relaxed text-river-ink2">{report.persona.desire}</p>
            </div>
          </div>
          <p className="text-[13.5px] leading-relaxed text-river-ink2 mb-6">{report.persona.contentAlignment}</p>
          <Label>Recomendações</Label>
          <Plain items={report.persona.recommendations} />
        </Section>

        {/* Success formula */}
        <Section title="Fórmula do Sucesso">
          <Label>Melhores formatos</Label>
          <Plain items={report.successFormula.bestFormats} />
          <div className="mt-6">
            <Label>Pilares de conteúdo</Label>
            <div className="space-y-2 text-[13.5px]">
              {report.successFormula.contentPillars.map((p) => (
                <p key={p.name}>
                  <span className="font-semibold text-river-ink">{p.name} — </span>
                  <span className="text-river-ink2">{p.description}</span>
                </p>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <Label>Frequência recomendada</Label>
            <p className="text-[13.5px] leading-relaxed text-river-ink2">{report.successFormula.postingFrequency}</p>
          </div>
        </Section>

        {/* Best times */}
        <Section title="Melhores Horários para Postar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <Label>Dias úteis</Label>
              <div className="space-y-1.5 text-[13.5px] text-river-ink tabular-nums">
                {report.bestTimes.weekdays.map((t, i) => <p key={i}>{t}</p>)}
              </div>
            </div>
            <div>
              <Label>Fins de semana</Label>
              <div className="space-y-1.5 text-[13.5px] text-river-ink tabular-nums">
                {report.bestTimes.weekends.map((t, i) => <p key={i}>{t}</p>)}
              </div>
            </div>
          </div>
        </Section>

        {/* Trends */}
        <Section title="Tendências de Mercado">
          <Plain items={report.marketTrends} />
        </Section>

        {/* Final recommendations */}
        <Section title="Recomendações Finais">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-6">
            <div>
              <Label>Principal força</Label>
              <p className="text-[13.5px] leading-relaxed text-river-ink2">{report.summary.mainStrength}</p>
            </div>
            <div>
              <Label>Principal fraqueza</Label>
              <p className="text-[13.5px] leading-relaxed text-river-ink2">{report.summary.mainWeakness}</p>
            </div>
          </div>
          <Label>Oportunidades identificadas</Label>
          <Plain items={report.summary.opportunities} />
        </Section>
      </div>

      <div className="text-center text-[11px] text-river-ink3 pt-14">
        Gerado por River Agency ·{" "}
        {new Date(report.generatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}
