export function FeedSkeleton() {
  return (
    <div className="mx-auto max-w-[470px] space-y-6">
      {[0, 1].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-river-line bg-white">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="h-8 w-8 rounded-full animate-shimmer" />
            <div className="h-3 w-28 rounded animate-shimmer" />
          </div>
          <div className="aspect-square w-full animate-shimmer" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-full rounded animate-shimmer" />
            <div className="h-3 w-2/3 rounded animate-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
