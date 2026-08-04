"use client";

interface LibraryHeaderProps {
 selectedCount: number;
 onClearSelection: () => void;
}

export function LibraryHeader({ selectedCount, onClearSelection }: LibraryHeaderProps) {
 if (selectedCount === 0) return null;
 
 return (
 <div className="absolute top-4 right-6 flex items-center gap-4 z-40">
 <p className="text-xs text-primary antialiased">
 {selectedCount} Records Selected
 </p>
 <button
 type="button"
 onClick={onClearSelection}
 className="text-xs text-muted-text hover:text-main-text transition-colors cursor-pointer antialiased"
 >
 Deselect
 </button>
 </div>
 );
}
