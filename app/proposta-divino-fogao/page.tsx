import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proposta Complementar | Divino Fogão | River Agency",
  description:
    "Proposta de gestão de tráfego pago para o Divino Fogão, Boulevard Shopping, Vitória da Conquista.",
};

const objetivos = [
  "Aumentar as visitas ao perfil do Instagram.",
  "Estimular o crescimento de seguidores da cidade.",
  "Ampliar o alcance dos Reels e das publicações.",
  "Incentivar interações, compartilhamentos e salvamentos.",
  "Reforçar a lembrança do restaurante na hora de escolher onde comer.",
];

const incluido = [
  "Análise e configuração inicial da estrutura de anúncios.",
  "Planejamento mensal das campanhas.",
  "Definição de públicos com foco em Vitória da Conquista.",
  "Seleção dos conteúdos com maior potencial para divulgação.",
  "Adaptação dos textos e chamadas dos anúncios.",
  "Gestão de até duas campanhas simultâneas.",
  "Testes de conteúdos e públicos dentro da verba disponível.",
  "Acompanhamento e ajustes semanais.",
  "Relatório mensal com resultados e próximos direcionamentos.",
];

const metricas = [
  "Investimento realizado",
  "Pessoas alcançadas",
  "Visitas ao perfil",
  "Interações",
  "Desempenho dos vídeos",
];

function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-[3px] h-[18px] w-[18px] shrink-0 text-river-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8.5" className="text-river-accentSoft" fill="currentColor" stroke="none" />
      <path d="M6.2 10.3l2.6 2.6 5-5.4" />
    </svg>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-river-ink">
          <Check />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-river-line pt-8">
      <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.16em] text-river-accent">
        {eyebrow}
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-river-ink2">{children}</div>
    </section>
  );
}

export default function PropostaDivinoFogao() {
  return (
    <main className="min-h-screen bg-river-canvas px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-[720px] space-y-10">
        {/* Cabeçalho */}
        <header className="flex items-center justify-between">
          <div className="select-none text-[15px] font-bold leading-none tracking-tight text-river-ink">
            River <span className="text-river-accent">Agency</span>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-river-ink3">
            Proposta complementar
          </div>
        </header>

        {/* Capa */}
        <section className="rounded-2xl bg-river-ink p-7 text-white sm:p-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
            Gestão de tráfego pago · Divino Fogão
          </p>
          <h1 className="mt-4 text-balance text-[28px] font-extrabold leading-[1.15] tracking-tight sm:text-[38px]">
            Mais pessoas conhecendo o restaurante. Mais oportunidades de fazer parte da rotina delas.
          </h1>
          <p className="mt-6 text-[14px] text-white/65">
            Boulevard Shopping — Vitória da Conquista
          </p>
        </section>

        {/* Contexto */}
        <section className="space-y-4 text-[16px] leading-relaxed text-river-ink">
          <p>
            O Divino Fogão já está construindo sua presença no Instagram com conteúdos que
            apresentam a unidade, o buffet e a experiência de comer no restaurante.
          </p>
          <p>
            O próximo passo é ampliar a distribuição desses conteúdos, alcançando pessoas de
            Vitória da Conquista que ainda não conhecem ou não acompanham o perfil.
          </p>
        </section>

        <Block eyebrow="Objetivo do trabalho">
          <p>
            Fortalecer a presença local do Divino Fogão e desenvolver uma audiência com potencial
            de visitar a unidade, buscando:
          </p>
          <List items={objetivos} />
        </Block>

        <Block eyebrow="Como vamos trabalhar">
          <p>
            Utilizaremos os conteúdos produzidos no trabalho mensal para criar anúncios que
            destaquem a comida, a variedade, a localização e as modalidades de serviço.
          </p>
          <p>
            A prioridade inicial será apresentar o restaurante a novos públicos e incentivar o
            acesso ao perfil. Os investimentos serão ajustados conforme os resultados, evitando
            dividir a verba em muitas campanhas ao mesmo tempo.
          </p>
        </Block>

        <section className="rounded-2xl border border-river-line bg-white p-6 shadow-[0_1px_2px_rgba(18,24,43,.04),0_12px_28px_-14px_rgba(18,24,43,.14)] sm:p-8">
          <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.16em] text-river-accent">
            O que está incluído
          </h2>
          <List items={incluido} />
          <p className="mt-6 rounded-xl bg-river-canvas px-4 py-3 text-[13px] leading-relaxed text-river-ink2">
            A produção de fotos e vídeos permanece vinculada ao serviço de conteúdo já contratado.
          </p>
        </section>

        <Block eyebrow="Como acompanharemos os resultados">
          <p>O relatório apresentará:</p>
          <div className="flex flex-wrap gap-2">
            {metricas.map((m) => (
              <span
                key={m}
                className="rounded-full border border-river-line bg-white px-3.5 py-1.5 text-[13px] font-semibold text-river-ink"
              >
                {m}
              </span>
            ))}
          </div>
          <p>
            Também acompanharemos a evolução dos seguidores, distinguindo os resultados atribuídos
            aos anúncios, quando disponíveis, do crescimento geral do perfil.
          </p>
          <p className="rounded-xl border border-river-accentSoft bg-river-accentSoft px-4 py-3 text-river-ink">
            O primeiro mês será dedicado à configuração, aos testes e à identificação dos conteúdos
            que despertam mais interesse no público local.
          </p>
        </Block>

        {/* Investimento */}
        <section className="rounded-2xl border border-river-line bg-white p-6 shadow-[0_1px_2px_rgba(18,24,43,.04),0_12px_28px_-14px_rgba(18,24,43,.14)] sm:p-8">
          <h2 className="mb-6 text-[11px] font-bold uppercase tracking-[0.16em] text-river-accent">
            Investimento mensal
          </h2>

          <dl className="divide-y divide-river-line">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4 first:pt-0">
              <div>
                <dt className="text-[15px] font-semibold text-river-ink">
                  Gestão de tráfego pago
                </dt>
                <dd className="mt-0.5 text-[13px] text-river-ink3">
                  Paga à River Agency
                </dd>
              </div>
              <dd className="text-[22px] font-extrabold tabular-nums text-river-ink">
                R$ 500,00
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
              <div>
                <dt className="text-[15px] font-semibold text-river-ink">
                  Verba inicial sugerida para anúncios
                </dt>
                <dd className="mt-0.5 text-[13px] text-river-ink3">
                  Aprox. R$ 20 por dia em 30 dias, paga diretamente à Meta pelo restaurante
                </dd>
              </div>
              <dd className="text-[22px] font-extrabold tabular-nums text-river-ink">
                R$ 600,00
              </dd>
            </div>
          </dl>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-river-accent px-5 py-4 text-white">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em]">
              Investimento complementar total sugerido
            </span>
            <span className="text-[26px] font-extrabold tabular-nums">
              R$ 1.100,00<span className="text-[14px] font-semibold text-white/75"> / mês</span>
            </span>
          </div>

          <ul className="mt-5 space-y-1.5 text-[13px] leading-relaxed text-river-ink2">
            <li>O valor é adicional ao serviço de conteúdo já contratado.</li>
            <li>Qualquer aumento da verba dependerá de aprovação prévia.</li>
          </ul>
        </section>

        <Block eyebrow="Condições para início">
          <p>
            Liberação dos acessos necessários, cadastro da forma de pagamento na plataforma e
            aprovação do planejamento inicial.
          </p>
          <p className="text-[13px] text-river-ink3">
            O trabalho busca crescimento consistente e relevante para o restaurante. Não contempla
            garantia de quantidade fixa de seguidores, interações ou vendas, pois os resultados
            dependem da verba, dos conteúdos e da resposta do público.
          </p>
        </Block>

        {/* Fechamento */}
        <footer className="border-t border-river-line pt-8 text-center">
          <p className="text-balance text-[18px] font-bold leading-snug text-river-ink">
            Conteúdo para despertar vontade. Estratégia para chegar a mais pessoas.
          </p>
          <p className="mt-4 text-[15px] font-bold tracking-tight text-river-ink">
            River <span className="text-river-accent">Agency</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
