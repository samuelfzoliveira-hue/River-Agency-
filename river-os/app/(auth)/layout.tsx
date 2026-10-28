export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden flex-col justify-between bg-[#0A1F33] p-12 text-[#F5F3ED] lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F3ED] font-bold text-[#0A1F33]">R</span>
          <span className="text-lg font-semibold tracking-tight">RIVER OS</span>
        </div>
        <div>
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Cada cliente recebe exatamente o que contratou.</p>
          <p className="mt-4 max-w-md text-sm text-[#F5F3ED]/70">Contratos, produção, equipe e prazos no mesmo lugar — para antecipar problemas antes que virem atrasos.</p>
        </div>
        <p className="text-xs text-[#8A8E94]">River Agency · sistema interno</p>
      </aside>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
