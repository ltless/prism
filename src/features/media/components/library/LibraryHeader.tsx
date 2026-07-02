import { m, AnimatePresence } from "motion/react";

interface LibraryHeaderProps {
  selectedCount: number;
  onClearSelection: () => void;
}

export function LibraryHeader({ selectedCount, onClearSelection }: LibraryHeaderProps) {
  return (
    <div className="absolute top-4 right-6 z-40 pointer-events-none">
      <AnimatePresence>
        {selectedCount > 0 && (
          <m.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-app-bg/85 backdrop-blur-sm border border-main-border/60 shadow-sm pointer-events-auto"
          >
            <p className="text-xs text-primary antialiased tabular-nums font-medium">
              <m.span
                key={selectedCount}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                {selectedCount}
              </m.span>{" "}
              Records Selected
            </p>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-muted-text hover:text-main-text transition-colors cursor-pointer antialiased"
            >
              Deselect
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
