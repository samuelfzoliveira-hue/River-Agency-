import { jsPDF } from "jspdf";
import type { Section } from "@/lib/report-sections";

const NAVY: [number, number, number] = [10, 31, 51];
const GRAY: [number, number, number] = [110, 114, 120];

/** Relatório operacional em A4 paisagem: uma tabela por seção, com cabeçalho repetido a cada página. */
export function buildReportPdf(o: { agency: string; periodLabel: string; filtersLabel: string; sections: Section[] }): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = 297, M = 14, BOTTOM = 196;
  let y = 0;
  const header = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 22, "F");
    doc.setTextColor(245, 243, 237); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("RIVER OS", M, 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`${o.agency} · Relatório operacional · ${o.periodLabel}`, M, 17);
    y = 32;
  };
  header();
  doc.setTextColor(...GRAY); doc.setFontSize(9); doc.text(o.filtersLabel, M, y); y += 8;

  for (const s of o.sections) {
    if (s.rows.length === 0 && s.key === "atrasadas") { /* seção vazia ainda é informativa */ }
    const n = s.headers.length;
    const colW = (W - 2 * M) / n;
    const need = 22;
    if (y + need > BOTTOM) { doc.addPage(); header(); }
    doc.setTextColor(17, 17, 17); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(s.title, M, y); y += 5;
    if (s.hint) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY); for (const l of doc.splitTextToSize(s.hint, W - 2 * M) as string[]) { doc.text(l, M, y); y += 4; } }
    const head = () => { doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GRAY); s.headers.forEach((h, i) => doc.text(doc.splitTextToSize(h, colW - 2)[0] as string, M + i * colW, y)); y += 2; doc.setDrawColor(224, 221, 211); doc.line(M, y, W - M, y); y += 4.5; };
    head();
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(17, 17, 17);
    if (s.rows.length === 0) { doc.setTextColor(...GRAY); doc.text("Sem dados no período.", M, y); y += 7; }
    for (const r of s.rows) {
      if (y > BOTTOM) { doc.addPage(); header(); doc.setTextColor(17, 17, 17); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(`${s.title} (cont.)`, M, y); y += 6; head(); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(17, 17, 17); }
      r.forEach((v, i) => doc.text(String(v ?? "").slice(0, i === 0 ? 38 : 22), M + i * colW, y));
      y += 5.5;
    }
    y += 8;
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...GRAY); doc.text(`Página ${i} de ${pages}`, W - M - 24, 205); }
  return doc;
}
