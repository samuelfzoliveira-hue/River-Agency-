"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export function Modal({
  onClose,
  children,
  className = "",
  contentClassName = "",
}: {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-river-ink/70 backdrop-blur-sm p-3 sm:p-6 animate-fade-in ${className}`}
      onClick={onClose}
    >
      <div
        className={`animate-modal-in max-h-full overflow-y-auto no-scrollbar ${contentClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
