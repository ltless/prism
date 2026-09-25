interface LibraryHeaderProps {
  title: string;
  total: number;
  shown: number;
  selectedCount: number;
  onClearSelection: () => void;
}

export function LibraryHeader({ title, total, shown, selectedCount, onClearSelection }: LibraryHeaderProps) {
  const countLabel = total > shown
    ? `${shown.toLocaleString()} of ${total.toLocaleString()}`
    : shown.toLocaleString();

  return (
    <header className="mb-8 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-4 inline-flex rounded-full bg-main-text/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-text">
          Archive
        </p>
        <h1 className="text-[2.5rem] font-medium leading-[0.92] tracking-[-0.045em] text-main-text md:text-[4.25rem]">
          {title}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-full bg-main-text/[0.04] p-1 ring-1 ring-main-text/[0.06]">
          <div className="rounded-full bg-panel-bg px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-[12px] tabular-nums tracking-[-0.01em] text-muted-text">
              <span className="font-medium text-main-text">{countLabel}</span>
              {" "}assets
            </p>
          </div>
        </div>

        {selectedCount > 0 && (
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center gap-2 rounded-full bg-main-text py-1.5 pl-4 pr-1.5 text-app-bg"
          >
            <span className="text-[12px] font-medium tabular-nums">{selectedCount} selected</span>
            <span className="flex h-7 items-center rounded-full bg-app-bg/15 px-2.5 text-[11px]">
              Deselect
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
