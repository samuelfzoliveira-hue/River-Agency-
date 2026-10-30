import { jsPDF } from "jspdf";
import { VERDICT_LABEL, type ClosingSnapshot, type PendingItem } from "@/lib/domain/closing";

export interface ClosingReport {
  agency: string;
  client: string;
  competenceLabel: string;
  snapshot: ClosingSnapshot;
  pending: PendingItem[];
  status: "fechado" | "reaberto" | "previa";
  closedAt?: string | null;
  closedBy?: string | null;
  notes?: string | null;
  reopenLog?: { at: string; by: string; reason: string }[];
}

const NAVY: [number, number, number] = [10, 31, 51];
const GRAY: [number, number, number] = [110, 114, 120];

/** Relatório de conclusão do mês (A4). Texto vetorial real, com quebra de página. */
export function buildClosingPdf(r: ClosingReport): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18;
  let y = 0;
  const ensure = (h: number) => { if (y + h > 280) { doc.addPage(); y = 20; } };

  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, "F");
  doc.setTextColor(245, 243, 237); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("RIVER OS", M, 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`${r.agency} · Relatório de fechamento mensal`, M, 23);
  y = 46;

  doc.setTextColor(17, 17, 17); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(r.client, M, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...GRAY);
  doc.text(`Competência: ${r.competenceLabel}`, M, y); y += 6;
  const st = r.status === "previa" ? "PRÉVIA — mês ainda não fechado" : r.status === "reaberto" ? "Fechamento reaberto" : "Fechamento oficial";
  doc.text(`Situação: ${st}`, M, y); y += 10;

  doc.setTextColor(17, 17, 17); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(`${VERDICT_LABEL[r.snapshot.verdict]}${r.snapshot.pct != null ? ` — ${r.snapshot.pct}%` : ""}`, M, y); y += 5;
  doc.setDrawColor(224, 221, 211); doc.setFillColor(236, 233, 224); doc.roundedRect(M, y, W - 2 * M, 3.5, 1.5, 1.5, "F");
  if (r.snapshot.pct) { doc.setFillColor(...NAVY); doc.roundedRect(M, y, ((W - 2 * M) * Math.min(r.snapshot.pct, 100)) / 100, 3.5, 1.5, 1.5, "F"); }
  y += 12;

  const cols = [M, 74, 98, 122, 146, 166, 186];
  const head = ["Entrega", "Contrat.", "Produz.", "Aprov.", "Public.", "Pend.", "Atras."];
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...GRAY);
  head.forEach((h, i) => doc.text(h, cols[i], y, i ? { align: "left" } : undefined)); y += 2;
  doc.line(M, y, W - M, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setTextColor(17, 17, 17); doc.setFontSize(10);
  for (const l of r.snapshot.lines) {
    ensure(7);
    const isShoot = l.kind === "shoot";
    const vals = [l.typeName, String(l.contracted), isShoot ? "—" : String(l.produced), isShoot ? "—" : String(l.approved), isShoot ? "—" : String(l.published), String(l.pending), String(l.late)];
    vals.forEach((v, i) => doc.text(v, cols[i], y));
    y += 6;
    if (l.extras || l.publishedLate) {
      doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text(`${l.extras ? `${l.extras} extra(s) fora da meta. ` : ""}${l.publishedLate ? `${l.publishedLate} publicado(s) fora do prazo.` : ""}`, M + 3, y - 1.5);
      doc.setFontSize(10); doc.setTextColor(17, 17, 17); y += 2;
    }
  }
  y += 2; doc.line(M, y, W - M, y); y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${r.snapshot.delivered} de ${r.snapshot.contracted} entregues · ${r.snapshot.pending} pendentes · ${r.snapshot.extras} extras`, M, y); y += 10;

  doc.setFont("helvetica", "bold"); doc.setFontSize(12); ensure(12); doc.text("Pendências transferidas para o mês seguinte", M, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  if (r.pending.length === 0) { doc.setTextColor(...GRAY); doc.text("Nenhuma pendência.", M, y); y += 8; }
  for (const p of r.pending) {
    ensure(6); doc.setTextColor(17, 17, 17);
    doc.text(`• ${p.quantity} × ${p.typeName} — competência original ${p.competence.slice(5, 7)}/${p.competence.slice(0, 4)}`, M, y); y += 6;
  }
  if (r.pending.length) { doc.setFontSize(8); doc.setTextColor(...GRAY); doc.text("As pendências mantêm a competência original e não são recontadas no mês seguinte.", M, y); y += 8; }

  if (r.notes) {
    ensure(20); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(17, 17, 17); doc.text("Observações", M, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const line of doc.splitTextToSize(r.notes, W - 2 * M) as string[]) { ensure(5); doc.text(line, M, y); y += 5; }
    y += 4;
  }
  if (r.reopenLog?.length) {
    ensure(20); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Histórico de reaberturas", M, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    for (const e of r.reopenLog) for (const line of doc.splitTextToSize(`${e.at.slice(0, 10).split("-").reverse().join("/")} · ${e.by} — ${e.reason}`, W - 2 * M) as string[]) { ensure(5); doc.text(line, M, y); y += 5; }
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text(`${r.closedAt ? `Fechado em ${r.closedAt.slice(0, 10).split("-").reverse().join("/")}${r.closedBy ? ` por ${r.closedBy}` : ""} · ` : ""}Página ${i} de ${pages}`, M, 290);
  }
  return doc;
}
