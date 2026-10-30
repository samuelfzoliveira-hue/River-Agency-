"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";
import type { Section } from "@/lib/report-sections";

export function ReportPdfButton({ agency, periodLabel, filtersLabel, sections, filename }: { agency: string; periodLabel: string; filtersLabel: string; sections: Section[]; filename: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="btn" disabled={busy} onClick={async () => {
      setBusy(true);
      try { const { buildReportPdf } = await import("@/lib/pdf/report"); buildReportPdf({ agency, periodLabel, filtersLabel, sections }).save(filename); } finally { setBusy(false); }
    }}><FileDown size={16} /> {busy ? "Gerando…" : "Exportar PDF"}</button>
  );
}
