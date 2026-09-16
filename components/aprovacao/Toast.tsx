"use client";

import { useEffect } from "react";

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="animate-fade-in-up fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-river-ink px-4 py-2.5 text-[12.5px] font-medium text-white shadow-xl">
      {message}
    </div>
  );
}
