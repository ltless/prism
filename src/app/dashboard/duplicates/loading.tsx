export default function DuplicatesLoading() {
  return (
    <div className="flex-1 p-4 md:p-6 space-y-5">
      <div className="h-6 w-28 bg-surface-bg rounded-md animate-pulse" />
      <div className="flex items-center gap-4 py-2">
        <div className="h-4 w-14 bg-surface-bg/60 rounded-md animate-pulse" />
        <div className="h-4 w-18 bg-surface-bg/60 rounded-md animate-pulse" />
        <div className="h-4 w-20 bg-surface-bg/60 rounded-md animate-pulse" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-panel-bg border border-main-border/30 rounded-md overflow-hidden shadow-card">
          <div className="px-4 py-2 border-b border-main-border/20 flex items-center gap-2">
            <div className="h-4 w-16 bg-surface-bg rounded-md animate-pulse" />
            <div className="h-4 w-12 bg-surface-bg/60 rounded-md animate-pulse" />
          </div>
          <div className="flex divide-x divide-main-border/20">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex-1 p-2.5 space-y-1.5">
                <div className="aspect-[4/3] bg-surface-bg rounded-md animate-pulse" />
                <div className="h-3 w-20 bg-surface-bg/60 rounded-md animate-pulse" />
                <div className="h-3 w-14 bg-surface-bg/60 rounded-md animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
