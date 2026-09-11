import { DiagnosticReport } from "@/lib/types";
import { Section } from "./Section";
import { ScoreRing } from "./ScoreRing";
import { ProgressBar } from "./ProgressBar";
import { SwotGrid } from "./SwotGrid";
import { Logo } from "./Logo";
import {
  IconTarget,
  IconTrendUp,
  IconUser,
  IconGrid,
  IconCompass,
  IconMask,
  IconSparkle,
  IconClock,
  IconBolt,
  IconLayers,
  IconScale,
} from "./icons";

function formatFollowers(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

export function ReportView({ report, id }: { report: DiagnosticReport; id?: string }) {
  const { profile } = report;

  return (
    <div id={id} className="max-w-3xl mx-auto space-y-6 pb-24">
      {/* Header / Profile card */}
      <div className="print-page bg-river-navy rounded-xl2 shadow-pop p-6 sm:p-8 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #4C8DFF 0%, transparent 45%), radial-gradient(circle at 85% 85%, #1D63E8 0%, transparent 40%)",
          }}
        />
        <div className="relative flex items-center justify-between mb-8">
          <Logo variant="light" />
          <span className="text-[11px] font-semibold tracking-wider uppercase text-white/60">
            Relatório de Análise
          </span>
        </div>
        <div className="relative flex items-center gap-4">
          {profile.profilePicUrl ? (
            <img
              src={profile.profilePicUrl}
              alt={profile.username}
              className="w-16 h-16 rounded-full object-cover border-2 border-white/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center font-display text-2xl font-bold">
              {profile.username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="font-display text-xl font-bold">@{profile.username}</div>
            <div className="text-white/70 text-sm">{profile.fullName}</div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold">
              {formatFollowers(profile.followers)}
            </div>
            <div className="text-white/60 text-xs">seguidores</div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold text-river-light">
              {profile.engagementRate?.toFixed(2)}%
            </div>
            <div className="text-white/60 text-xs">engajamento</div>
          </div>
        </div>
      </div>

      {report.dataSource === "demo" && (
        <div className="no-print bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-4">
          Este é um relatório de <strong>demonstração</strong>. Configure a variável de ambiente{" "}
          <code className="bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> para gerar
          diagnósticos reais a partir de qualquer perfil do Instagram.
        </div>
      )}

      {/* Score Geral */}
      <Section title="Score Geral do Perfil" icon={<IconTarget />}>
        <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start">
          <ScoreRing score={report.overallScore} />
          <div className="flex-1 w-full">
            {report.scoreBreakdown.map((s) => (
              <ProgressBar key={s.label} label={s.label} score={s.score} compact />
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-river-navy/80 bg-river-mist rounded-lg p-4 border border-river-sky">
          {report.overallSummary}
        </p>
      </Section>

      {/* Evolução do perfil */}
      <Section title="Projeção de Evolução do Perfil" icon={<IconTrendUp />}>
        <ProgressBar label="Atual" score={report.evolution.current} />
        {report.evolution.phases.map((phase, i) => (
          <div key={phase.name} className="mb-4">
            <ProgressBar label={`Fase ${i + 1} · ${phase.name}`} score={phase.score} compact />
            <p className="text-sm text-river-navy/75 leading-relaxed pl-0.5">{phase.description}</p>
          </div>
        ))}
      </Section>

      {/* Bio Diagnosis */}
      <Section title="Diagnóstico de Bio e Perfil" icon={<IconUser />}>
        <ProgressBar label="Score de alinhamento" score={report.bioDiagnosis.alignmentScore} />
        <div className="bg-river-mist border border-river-sky rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-river-blue/70 mb-1">
            Bio atual
          </p>
          <p className="text-sm italic text-river-navy/85">&ldquo;{report.bioDiagnosis.currentBio}&rdquo;</p>
        </div>
        <p className="text-sm leading-relaxed text-river-navy/85 mb-4">
          {report.bioDiagnosis.analysis}
        </p>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-5">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-700 mb-2">
            Problemas identificados
          </p>
          <ul className="space-y-1.5">
            {report.bioDiagnosis.problems.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-rose-900/90">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-3">
            Estrutura da bio ideal
          </p>
          <p className="text-sm mb-1.5">
            <span className="font-semibold text-emerald-800">Promessa: </span>
            {report.bioDiagnosis.idealBio.promise}
          </p>
          <p className="text-sm mb-1.5">
            <span className="font-semibold text-emerald-800">Autoridade: </span>
            {report.bioDiagnosis.idealBio.authority}
          </p>
          <p className="text-sm">
            <span className="font-semibold text-emerald-800">CTA: </span>
            {report.bioDiagnosis.idealBio.cta}
          </p>
        </div>
      </Section>

      {/* Engagement */}
      <Section title="Análise de Engajamento" icon={<IconBolt />}>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-5 text-center">
            <div className="font-display text-3xl font-bold text-rose-600">
              {report.engagement.rate.toFixed(2)}%
            </div>
            <div className="text-xs text-rose-700/80 mt-1">Sua taxa</div>
          </div>
          <div className="bg-river-mist border border-river-sky rounded-lg p-5 text-center">
            <div className="font-display text-3xl font-bold text-river-navy">
              {report.engagement.marketAverage.toFixed(1)}%
            </div>
            <div className="text-xs text-river-navy/60 mt-1">Média de mercado</div>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-river-navy/85">{report.engagement.analysis}</p>
        <div className="flex gap-6 mt-4 text-sm text-river-navy/70">
          <span>
            <strong className="text-river-navy">{report.engagement.avgLikes}</strong> curtidas/post
          </span>
          <span>
            <strong className="text-river-navy">{report.engagement.avgComments}</strong> comentários/post
          </span>
        </div>
      </Section>

      {/* Gaps */}
      <Section title="Gaps Identificados" icon={<IconCompass />}>
        <div className="space-y-3">
          {report.gaps.map((g) => (
            <div key={g.title} className="bg-river-mist border border-river-sky rounded-lg p-4">
              <p className="font-semibold text-sm text-river-navy mb-1">{g.title}</p>
              <p className="text-sm text-river-navy/75 leading-relaxed">{g.description}</p>
            </div>
          ))}
        </div>
        {report.identityCrisisNote && (
          <p className="mt-5 text-sm leading-relaxed text-river-navy/85 border-t border-river-sky pt-4">
            {report.identityCrisisNote}
          </p>
        )}
      </Section>

      {/* SWOT */}
      <Section title="Análise SWOT" icon={<IconGrid />}>
        <SwotGrid swot={report.swot} />
      </Section>

      {/* Market Positioning */}
      <Section title="Posicionamento de Mercado" icon={<IconCompass />}>
        <p className="text-sm leading-relaxed text-river-navy/85 mb-5">
          {report.marketPositioning.summary}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-2">
              Vantagens únicas
            </p>
            <ul className="space-y-1.5">
              {report.marketPositioning.uniqueAdvantages.map((a, i) => (
                <li key={i} className="text-sm text-emerald-900/90 flex gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700 mb-2">
              Gaps a preencher
            </p>
            <ul className="space-y-1.5">
              {report.marketPositioning.gapsToFill.map((a, i) => (
                <li key={i} className="text-sm text-rose-900/90 flex gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Archetypes */}
      <Section title="Posicionamento / Arquétipo" icon={<IconMask />}>
        <div className="space-y-5">
          {report.archetypes.map((a) => (
            <div key={a.name} className="border-l-4 border-river-primary pl-4">
              <p className="font-display font-bold text-river-navy">
                {a.name} <span className="font-sans font-normal text-sm text-river-navy/50">({a.subtitle})</span>
              </p>
              <p className="text-sm text-river-navy/80 mt-1.5">
                <strong>O que é: </strong>
                {a.whatItIs}
              </p>
              <p className="text-sm text-river-navy/80 mt-1">
                <strong>No perfil: </strong>
                {a.inProfile}
              </p>
              <p className="text-sm text-river-navy/80 mt-1">
                <strong>O que significa pra você: </strong>
                {a.whatItMeansForYou}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Persona */}
      <Section title="Análise de Persona / Avatar" icon={<IconUser />}>
        <p className="text-xs font-bold uppercase tracking-wide text-river-blue/70 mb-1">
          Avatar ideal
        </p>
        <p className="text-sm text-river-navy/85 mb-4 leading-relaxed">{report.persona.idealAvatar}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-river-mist border border-river-sky rounded-lg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-river-navy/60 mb-1">Dor</p>
            <p className="text-sm text-river-navy/80">{report.persona.pain}</p>
          </div>
          <div className="bg-river-mist border border-river-sky rounded-lg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-river-navy/60 mb-1">Desejo</p>
            <p className="text-sm text-river-navy/80">{report.persona.desire}</p>
          </div>
        </div>
        <p className="text-sm text-river-navy/85 mb-4 leading-relaxed">
          {report.persona.contentAlignment}
        </p>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-700 mb-2">Recomendações</p>
          <ul className="space-y-1.5">
            {report.persona.recommendations.map((r, i) => (
              <li key={i} className="text-sm text-rose-900/90 flex gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Success Formula */}
      <Section title="Fórmula do Sucesso" icon={<IconSparkle />}>
        <p className="text-xs font-bold uppercase tracking-wide text-river-blue/70 mb-2">
          Melhores formatos
        </p>
        <div className="space-y-2 mb-5">
          {report.successFormula.bestFormats.map((f, i) => (
            <div key={i} className="bg-river-mist border border-river-sky rounded-lg p-3 text-sm text-river-navy/85">
              {f}
            </div>
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-river-blue/70 mb-2">
          Pilares de conteúdo
        </p>
        <div className="space-y-2 mb-5">
          {report.successFormula.contentPillars.map((p) => (
            <div key={p.name} className="text-sm">
              <span className="font-semibold text-river-navy">{p.name}: </span>
              <span className="text-river-navy/75">{p.description}</span>
            </div>
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-river-blue/70 mb-1">
          Frequência recomendada
        </p>
        <p className="text-sm text-river-navy/85">{report.successFormula.postingFrequency}</p>
      </Section>

      {/* Best times */}
      <Section title="Melhores Horários para Postar" icon={<IconClock />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-river-mist border border-river-sky rounded-lg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-river-navy/60 mb-2">
              Dias úteis
            </p>
            <ul className="space-y-1">
              {report.bestTimes.weekdays.map((t, i) => (
                <li key={i} className="text-sm text-river-navy/85">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-river-mist border border-river-sky rounded-lg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-river-navy/60 mb-2">
              Fins de semana
            </p>
            <ul className="space-y-1">
              {report.bestTimes.weekends.map((t, i) => (
                <li key={i} className="text-sm text-river-navy/85">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Trends */}
      <Section title="Tendências de Mercado" icon={<IconLayers />}>
        <div className="space-y-2">
          {report.marketTrends.map((t, i) => (
            <div key={i} className="bg-river-mist border border-river-sky rounded-lg p-3 text-sm text-river-navy/85">
              {t}
            </div>
          ))}
        </div>
      </Section>

      {/* Final recommendations */}
      <Section title="Recomendações Finais" icon={<IconSparkle />}>
        <ul className="space-y-2.5">
          {report.finalRecommendations.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm text-river-navy/85 leading-relaxed">
              <span className="shrink-0 w-6 h-6 rounded-full bg-river-primary text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              {r}
            </li>
          ))}
        </ul>
      </Section>

      {/* Summary */}
      <Section title="Resumo de Forças e Fraquezas" icon={<IconScale />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-2">
              Principal força
            </p>
            <p className="text-sm text-emerald-900/90">{report.summary.mainStrength}</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700 mb-2">
              Principal fraqueza
            </p>
            <p className="text-sm text-rose-900/90">{report.summary.mainWeakness}</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-river-blue mb-2">
            Oportunidades identificadas
          </p>
          <ul className="space-y-1.5">
            {report.summary.opportunities.map((o, i) => (
              <li key={i} className="text-sm text-river-navy/85 flex gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-river-primary shrink-0" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <div className="text-center text-xs text-river-navy/40 pt-4">
        Gerado por River Agency ·{" "}
        {new Date(report.generatedAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </div>
    </div>
  );
}
