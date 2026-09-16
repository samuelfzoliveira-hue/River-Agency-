export function EmptyState({ isAdmin, onAdd }: { isAdmin: boolean; onAdd: () => void }) {
  return (
    <div className="animate-fade-in-up mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-river-line bg-white/60 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-river-accentSoft text-[22px]">
        🖼️
      </div>
      <h3 className="text-[15px] font-semibold text-river-ink">Nenhum conteúdo por aqui ainda</h3>
      <p className="text-[13px] leading-relaxed text-river-ink3">
        {isAdmin
          ? "Publique o primeiro post, story ou reels para que o cliente possa aprovar."
          : "Assim que a agência publicar novos materiais, eles aparecem aqui para aprovação."}
      </p>
      {isAdmin && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 rounded-lg bg-river-accent px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-river-accentDeep"
        >
          + Adicionar conteúdo
        </button>
      )}
    </div>
  );
}
