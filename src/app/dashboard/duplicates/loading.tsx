export default function DuplicatesLoading() {
 return (
 <div className="flex-1 p-6 space-y-6">
 <div className="h-8 w-32 bg-surface-bg rounded-xl animate-pulse" />
 <div className="flex items-center gap-6 py-3">
 <div className="h-5 w-16 bg-surface-bg rounded animate-pulse" />
 <div className="h-5 w-20 bg-surface-bg rounded animate-pulse" />
 <div className="h-5 w-24 bg-surface-bg rounded animate-pulse" />
 </div>
 {Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="bg-panel-bg border border-main-border/50 rounded-2xl overflow-hidden">
 <div className="px-5 py-3 border-b border-main-border/30 flex items-center gap-2.5">
 <div className="h-5 w-20 bg-surface-bg rounded-md animate-pulse" />
 <div className="h-5 w-16 bg-surface-bg rounded animate-pulse" />
 </div>
 <div className="flex divide-x divide-main-border/30">
 {Array.from({ length: 3 }).map((_, j) => (
 <div key={j} className="flex-1 p-3 space-y-2">
 <div className="aspect-[4/3] bg-surface-bg rounded-lg animate-pulse" />
 <div className="h-3 w-24 bg-surface-bg rounded animate-pulse" />
 <div className="h-3 w-16 bg-surface-bg rounded animate-pulse" />
 <div className="h-7 w-full bg-surface-bg rounded-lg animate-pulse" />
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 );
}
