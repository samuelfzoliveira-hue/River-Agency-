"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";
import type { ClosingReport } from "@/lib/pdf/closing";

export function ClosingPdfButton({ report, filename }: { report: ClosingReport; filename: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="btn" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const { buildClosingPdf } = await import("@/lib/pdf/closing"); // jsPDF só carrega quando necessário
        buildClosingPdf(report).save(filename);
      } finally { setBusy(false); }
    }}><FileDown size={16} /> {busy ? "Gerando…" : "Exportar PDF"}</button>
  );
}
