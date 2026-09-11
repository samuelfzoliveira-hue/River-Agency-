export function Section({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`print-page bg-white rounded-xl2 shadow-card border border-river-sky p-6 sm:p-8 ${className}`}>
      <h2 className="font-display text-xl sm:text-2xl font-bold text-river-navy mb-5 flex items-center gap-2.5">
        {icon && <span className="text-river-primary">{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}
