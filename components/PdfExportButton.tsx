"use client";

import { useState } from "react";
import { DiagnosticReport } from "@/lib/types";

export function PdfExportButton({ report, filename }: { report: DiagnosticReport; filename: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const { buildDiagnosticPdf } = await import("@/lib/pdf");
      const pdf = buildDiagnosticPdf(report);
      pdf.save(filename);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="no-print text-[13px] font-semibold text-river-accent hover:text-river-accentDeep transition disabled:opacity-50"
    >
      {loading ? "Gerando PDF..." : "Baixar PDF"}
    </button>
  );
}
