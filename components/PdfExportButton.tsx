"use client";

import { useState } from "react";

export function PdfExportButton({ targetId, filename }: { targetId: string; filename: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const el = document.getElementById(targetId);
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#F4F8FF",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(filename);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="no-print inline-flex items-center gap-2 rounded-lg bg-white border border-river-primary text-river-primary text-sm font-semibold px-4 py-2.5 hover:bg-river-sky transition disabled:opacity-60"
    >
      {loading ? "Gerando PDF..." : "Baixar PDF"}
    </button>
  );
}
