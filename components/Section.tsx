export function Section({
  title,
  children,
  elevated = false,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  elevated?: boolean;
  className?: string;
}) {
  if (elevated) {
    return (
      <section className={`print-page bg-white rounded-2xl border border-river-line shadow-[0_1px_2px_rgba(18,24,43,.04),0_12px_28px_-14px_rgba(18,24,43,.14)] p-6 sm:p-7 ${className}`}>
        <h2 className="text-[17px] font-bold text-river-ink mb-5">{title}</h2>
        {children}
      </section>
    );
  }

  return (
    <section className={`print-page border-t border-river-line pt-8 ${className}`}>
      <h2 className="text-[17px] font-bold text-river-ink mb-5">{title}</h2>
      {children}
    </section>
  );
}
