export function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`print-page border-t border-river-line pt-8 ${className}`}>
      <h2 className="text-[17px] font-bold text-river-ink mb-5">{title}</h2>
      {children}
    </section>
  );
}
