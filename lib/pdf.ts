import { jsPDF } from "jspdf";
import { DiagnosticReport } from "./types";

type RGB = [number, number, number];

const C = {
  ink: [18, 24, 43] as RGB,
  ink2: [91, 100, 120] as RGB,
  ink3: [118, 127, 147] as RGB,
  line: [225, 228, 238] as RGB,
  accent: [21, 84, 240] as RGB,
  accentDeep: [13, 63, 196] as RGB,
  good: [21, 128, 78] as RGB,
  goodSoft: [231, 246, 238] as RGB,
  goodLine: [191, 230, 210] as RGB,
  bad: [210, 60, 80] as RGB,
  badSoft: [252, 234, 238] as RGB,
  badLine: [245, 201, 210] as RGB,
  warn: [169, 118, 13] as RGB,
  warnSoft: [251, 241, 220] as RGB,
  warnLine: [239, 220, 168] as RGB,
  accentSoft: [234, 240, 254] as RGB,
  accentSoftLine: [201, 217, 252] as RGB,
  neutralSoft: [244, 246, 250] as RGB,
};

type Tone = "good" | "bad" | "accent" | "warn" | "neutral";
const TONES: Record<Tone, [RGB, RGB, RGB]> = {
  good: [C.goodSoft, C.goodLine, C.good],
  bad: [C.badSoft, C.badLine, C.bad],
  accent: [C.accentSoft, C.accentSoftLine, C.accentDeep],
  warn: [C.warnSoft, C.warnLine, C.warn],
  neutral: [C.neutralSoft, C.line, C.ink3],
};

type BoxNode =
  | { kind: "p"; text: string; size?: number; gap?: number }
  | { kind: "bullets"; items: string[] }
  | { kind: "kv"; pairs: [string, string][] };

function fmtFollowers(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

/**
 * Builds the diagnostic as a native PDF — real vector text and shapes, not
 * a screenshot. A rasterized full-page screenshot sliced across fixed-height
 * pages cuts boxes/paragraphs in half wherever a page boundary happens to
 * land, and because the page is then just one big image, iOS's PDF viewer
 * applies its automatic "dark mode" color adaptation to it, which mangles
 * the colors. Real text/shape commands avoid both problems.
 */
export function buildDiagnosticPdf(r: DiagnosticReport): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const M = 50;
  const CW = pageW - M * 2;
  let y = M;

  function setText(c: RGB) {
    pdf.setTextColor(c[0], c[1], c[2]);
  }
  function setFill(c: RGB) {
    pdf.setFillColor(c[0], c[1], c[2]);
  }
  function setDraw(c: RGB) {
    pdf.setDrawColor(c[0], c[1], c[2]);
  }
  function tierColor(score: number): RGB {
    if (score >= 80) return C.good;
    if (score >= 55) return C.accent;
    if (score >= 35) return C.warn;
    return C.bad;
  }
  function ensure(h: number) {
    if (y + h > pageH - M) {
      pdf.addPage();
      y = M;
    }
  }
  function measure(text: string, width: number, size: number, style: string = "normal"): string[] {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    return pdf.splitTextToSize(String(text ?? ""), width) as string[];
  }
  function drawLines(lines: string[], x: number, topY: number, size: number, style: string, color: RGB): number {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    setText(color);
    const lh = size * 1.5;
    lines.forEach((line, i) => pdf.text(line, x, topY + i * lh + size * 0.8));
    return lines.length * lh;
  }

  function heading(text: string) {
    ensure(48);
    y += 18;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14.5);
    setText(C.ink);
    pdf.text(text, M, y);
    y += 9;
    setDraw(C.line);
    pdf.setLineWidth(0.75);
    pdf.line(M, y, M + CW, y);
    y += 18;
  }
  function para(
    text: string,
    opts: { size?: number; width?: number; x?: number; style?: string; color?: RGB; gap?: number } = {}
  ) {
    const size = opts.size ?? 10.5;
    const width = opts.width ?? CW;
    const x = opts.x ?? M;
    const lines = measure(text, width, size, opts.style);
    ensure(lines.length * size * 1.5 + 4);
    const h = drawLines(lines, x, y, size, opts.style ?? "normal", opts.color ?? C.ink2);
    y += h + (opts.gap ?? 10);
  }
  function bulletList(items: string[], opts: { size?: number; width?: number; x?: number; dot?: RGB; gap?: number } = {}) {
    const size = opts.size ?? 10.5;
    const width = (opts.width ?? CW) - 14;
    const x = (opts.x ?? M) + 14;
    (items || []).forEach((item) => {
      const lines = measure(item, width, size);
      ensure(lines.length * size * 1.5 + 4);
      setFill(opts.dot ?? C.ink3);
      pdf.circle(x - 9, y + size * 0.35, 1.5, "F");
      const h = drawLines(lines, x, y, size, "normal", C.ink);
      y += h + 4;
    });
    y += opts.gap ?? 8;
  }

  function boxInnerHeight(nodes: BoxNode[], innerWidth: number): number {
    let h = 18;
    nodes.forEach((n) => {
      if (n.kind === "p") {
        const size = n.size ?? 10.5;
        const lines = measure(n.text, innerWidth, size);
        h += lines.length * size * 1.5 + (n.gap ?? 8);
      } else if (n.kind === "bullets") {
        n.items.forEach((item) => {
          const lines = measure(item, innerWidth - 14, 10.5);
          h += lines.length * 10.5 * 1.5 + 4;
        });
        h += 2;
      } else if (n.kind === "kv") {
        n.pairs.forEach(([k, v]) => {
          const lines = measure(`${k} — ${v}`, innerWidth, 10.5);
          h += lines.length * 10.5 * 1.5 + 6;
        });
      }
    });
    return h;
  }
  function box(tone: Tone, label: string, nodes: BoxNode[]) {
    const pad = 16;
    const innerWidth = CW - pad * 2;
    const contentH = boxInnerHeight(nodes, innerWidth);
    const boxH = contentH + pad * 2;
    ensure(boxH + 14);

    const palette = TONES[tone] ?? TONES.neutral;
    setFill(palette[0]);
    setDraw(palette[1]);
    pdf.setLineWidth(1);
    pdf.roundedRect(M, y, CW, boxH, 6, 6, "FD");

    const cx = M + pad;
    let cy = y + pad;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    setText(palette[2]);
    pdf.text(label.toUpperCase(), cx, cy + 6);
    cy += 18;

    nodes.forEach((n) => {
      if (n.kind === "p") {
        const size = n.size ?? 10.5;
        const lines = measure(n.text, innerWidth, size);
        cy += drawLines(lines, cx, cy, size, "normal", C.ink);
        cy += n.gap ?? 8;
      } else if (n.kind === "bullets") {
        n.items.forEach((item) => {
          const lines = measure(item, innerWidth - 14, 10.5);
          setFill(palette[2]);
          pdf.circle(cx + 3, cy + 10.5 * 0.35, 1.5, "F");
          cy += drawLines(lines, cx + 12, cy, 10.5, "normal", C.ink);
          cy += 4;
        });
        cy += 2;
      } else if (n.kind === "kv") {
        n.pairs.forEach(([k, v]) => {
          const lines = measure(`${k} — ${v}`, innerWidth, 10.5);
          cy += drawLines(lines, cx, cy, 10.5, "normal", C.ink);
          cy += 6;
        });
      }
    });

    y += boxH + 14;
  }

  function bar(label: string, score: number, opts: { color?: RGB } = {}) {
    ensure(28);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10.5);
    setText(C.ink);
    pdf.text(label, M, y + 8);
    setText(C.ink2);
    pdf.text(String(Math.round(score)), M + CW, y + 8, { align: "right" });
    y += 13;
    const trackH = 5;
    setFill(C.line);
    pdf.roundedRect(M, y, CW, trackH, 2, 2, "F");
    const fillColor = opts.color ?? tierColor(score);
    const w = Math.max(8, (CW * Math.max(2, Math.min(100, score))) / 100);
    setFill(fillColor);
    pdf.roundedRect(M, y, w, trackH, 2, 2, "F");
    y += trackH + 13;
  }

  // Brand header
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  setText(C.ink);
  pdf.text("River", M, y + 13);
  const riverW = pdf.getTextWidth("River ");
  setText(C.accent);
  pdf.text("Agency", M + riverW, y + 13);
  y += 18;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  setText(C.ink3);
  pdf.text("DIAGNÓSTICO DE PERFIL", M, y + 8);
  y += 26;

  // Profile block
  const p = r.profile;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  setText(C.ink);
  pdf.text(`@${p.username}`, M, y + 12);
  y += 17;
  if (p.fullName) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10.5);
    setText(C.ink2);
    pdf.text(p.fullName, M, y + 8);
    y += 16;
  }
  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12.5);
  setText(C.ink);
  pdf.text(`${fmtFollowers(p.followers)} seguidores`, M, y + 9);
  setText(C.accent);
  pdf.text(`${Number(p.engagementRate || 0).toFixed(2)}% engajamento`, M + 170, y + 9);
  y += 24;
  setDraw(C.line);
  pdf.setLineWidth(0.75);
  pdf.line(M, y, M + CW, y);
  y += 6;

  // Score
  heading("Score Geral do Perfil");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(30);
  setText(tierColor(r.overallScore));
  pdf.text(`${Math.round(r.overallScore)} / 100`, M, y + 22);
  y += 38;
  r.scoreBreakdown.forEach((s) => bar(s.label, s.score));
  para(r.overallSummary, { gap: 4 });

  // Evolution
  heading("Projeção de Evolução do Perfil");
  bar("Atual", r.evolution.current, { color: C.accent });
  r.evolution.phases.forEach((ph, i) => {
    para(`${i + 1}. ${ph.name}   ${Math.round(ph.score)}/100`, { style: "bold", size: 11, gap: 3 });
    para(ph.description, { gap: 12 });
  });

  // Bio
  heading("Diagnóstico de Bio e Perfil");
  bar("Score de alinhamento", r.bioDiagnosis.alignmentScore);
  para(`"${r.bioDiagnosis.currentBio}"`, { style: "italic", color: C.ink2, gap: 8 });
  para(r.bioDiagnosis.analysis, { gap: 10 });
  box("bad", "Problemas identificados", [{ kind: "bullets", items: r.bioDiagnosis.problems }]);
  box("good", "Estrutura da bio ideal", [
    {
      kind: "kv",
      pairs: [
        ["Promessa", r.bioDiagnosis.idealBio.promise],
        ["Autoridade", r.bioDiagnosis.idealBio.authority],
        ["CTA", r.bioDiagnosis.idealBio.cta],
      ],
    },
  ]);

  // Engagement
  heading("Análise de Engajamento");
  const eg = r.engagement;
  para(
    `Sua taxa: ${eg.rate.toFixed(2)}%    Média de mercado: ${eg.marketAverage.toFixed(1)}%    ${eg.avgLikes} curtidas/post    ${eg.avgComments} comentários/post`,
    { style: "bold", color: C.ink, gap: 8 }
  );
  para(eg.analysis, { gap: 10 });

  // Gaps
  heading("Gaps Identificados");
  r.gaps.forEach((g) => {
    para(g.title, { style: "bold", size: 11, gap: 3 });
    para(g.description, { gap: 12 });
  });
  if (r.identityCrisisNote) para(r.identityCrisisNote, { gap: 4 });

  // SWOT
  heading("Análise SWOT");
  box("good", "Forças", [{ kind: "bullets", items: r.swot.strengths }]);
  box("bad", "Fraquezas", [{ kind: "bullets", items: r.swot.weaknesses }]);
  box("accent", "Oportunidades", [{ kind: "bullets", items: r.swot.opportunities }]);
  box("warn", "Ameaças", [{ kind: "bullets", items: r.swot.threats }]);

  // Market positioning
  heading("Posicionamento de Mercado");
  para(r.marketPositioning.summary, { gap: 10 });
  box("good", "Vantagens únicas", [{ kind: "bullets", items: r.marketPositioning.uniqueAdvantages }]);
  box("bad", "Gaps a preencher", [{ kind: "bullets", items: r.marketPositioning.gapsToFill }]);

  // Archetypes
  heading("Posicionamento / Arquétipo");
  r.archetypes.forEach((a) => {
    para(`${a.name}  (${a.subtitle})`, { style: "bold", size: 11.5, gap: 5 });
    para(`O que é — ${a.whatItIs}`, { gap: 4 });
    para(`No perfil — ${a.inProfile}`, { gap: 4 });
    para(`Pra você — ${a.whatItMeansForYou}`, { gap: 14 });
  });

  // Persona
  heading("Análise de Persona / Avatar");
  para(r.persona.idealAvatar, { gap: 10 });
  box("neutral", "Dor", [{ kind: "p", text: r.persona.pain }]);
  box("accent", "Desejo", [{ kind: "p", text: r.persona.desire }]);
  para(r.persona.contentAlignment, { gap: 10 });
  box("accent", "Recomendações", [{ kind: "bullets", items: r.persona.recommendations }]);

  // Success formula
  heading("Fórmula do Sucesso");
  para("Melhores formatos:", { style: "bold", color: C.ink, gap: 6 });
  bulletList(r.successFormula.bestFormats);
  para("Pilares de conteúdo:", { style: "bold", color: C.ink, gap: 6 });
  r.successFormula.contentPillars.forEach((pl) => {
    para(`${pl.name} — ${pl.description}`, { gap: 6 });
  });
  para(`Frequência recomendada: ${r.successFormula.postingFrequency}`, { gap: 10 });

  // Best times
  heading("Melhores Horários para Postar");
  para(`Dias úteis: ${r.bestTimes.weekdays.join("   ·   ")}`, { style: "bold", color: C.ink, gap: 6 });
  para(`Fins de semana: ${r.bestTimes.weekends.join("   ·   ")}`, { style: "bold", color: C.ink, gap: 14 });

  // Trends
  heading("Tendências de Mercado");
  bulletList(r.marketTrends);

  // Final recommendations
  heading("Recomendações Finais");
  r.finalRecommendations.forEach((rec, i) => {
    para(`${i + 1}. ${rec}`, { color: C.ink, gap: 10 });
  });

  // Summary
  heading("Resumo de Forças e Fraquezas");
  box("good", "Principal força", [{ kind: "p", text: r.summary.mainStrength }]);
  box("bad", "Principal fraqueza", [{ kind: "p", text: r.summary.mainWeakness }]);
  box("accent", "Oportunidades identificadas", [{ kind: "bullets", items: r.summary.opportunities }]);

  // Footer on every page
  const pageCount: number = (pdf.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages();
  const dateStr = new Date(r.generatedAt || Date.now()).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  for (let pi = 1; pi <= pageCount; pi++) {
    pdf.setPage(pi);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    setText(C.ink3);
    pdf.text(`River Agency · Diagnóstico de Perfil · ${dateStr}`, M, pageH - 26);
    pdf.text(`${pi} / ${pageCount}`, pageW - M, pageH - 26, { align: "right" });
  }

  return pdf;
}
