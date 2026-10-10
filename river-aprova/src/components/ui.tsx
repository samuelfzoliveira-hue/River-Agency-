import { useEffect, type ReactNode } from "react";
import { useSignedUrls } from "../lib/storage";
import { STATUS_LABEL, type ContentStatus } from "../lib/types";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const BADGE: Record<ContentStatus, string> = {
  aguardando: "bg-amber-100 text-amber-800",
  ajuste_solicitado: "bg-red-100 text-red-700",
  aprovado: "bg-emerald-100 text-emerald-800",
  publicado: "bg-sky-soft text-navy",
};
export function StatusBadge({ status }: { status: ContentStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function Avatar({ path, name, size = 36 }: { path: string | null | undefined; name: string; size?: number }) {
  const urls = useSignedUrls([path]);
  const src = path ? urls[path] : undefined;
  const style = { width: size, height: size };
  return src ? (
    <img src={src} alt={name} style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span style={{ ...style, fontSize: size * 0.4 }} className="flex shrink-0 items-center justify-center rounded-full bg-sky-soft font-semibold text-navy">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export const IconCarousel = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-label="Carrossel"><path d="M7 4h11a2 2 0 0 1 2 2v11h-2V6H7V4zM4 7h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" /></svg>
);
export const IconReels = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Reels">
    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M3 9h18M9 3l3 6M15 3l3 6" /><path d="M10.5 13.5v4l3.5-2z" fill="currentColor" />
  </svg>
);
export const Spinner = () => <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-navy/20 border-t-navy" />;
