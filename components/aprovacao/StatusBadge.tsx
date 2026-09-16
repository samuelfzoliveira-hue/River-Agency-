import type { ApprovalStatus } from "@/lib/aprovacao/types";

const CONFIG: Record<ApprovalStatus, { label: string; className: string; dot: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-river-warnSoft text-river-warn border-river-warnLine",
    dot: "bg-river-warn",
  },
  aprovado: {
    label: "Aprovado",
    className: "bg-river-goodSoft text-river-good border-river-goodLine",
    dot: "bg-river-good",
  },
  ajustes: {
    label: "Ajustes pedidos",
    className: "bg-river-badSoft text-river-bad border-river-badLine",
    dot: "bg-river-bad",
  },
};

export function StatusBadge({ status, className = "" }: { status: ApprovalStatus; className?: string }) {
  const cfg = CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-tight ${cfg.className} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
