interface EmptyLibraryProps {
  isFolder: boolean;
}

function FolderIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500/40">
      <path d="M12 28V20C12 17.79 13.79 16 16 16H28.5L32.5 22H64C66.21 22 68 23.79 68 26V28H12Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M12 28V58C12 60.21 13.79 62 16 62H64C66.21 62 68 60.21 68 58V28H12Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M34 42H56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 48H52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UploadIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500/40">
      <rect x="14" y="18" width="52" height="44" rx="4" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      <circle cx="40" cy="38" r="8" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path d="M40 34V42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 38H44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26 56L34 50L38 54L46 46L54 52L56 56" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyLibrary({ isFolder }: EmptyLibraryProps) {
  return (
    <div className="flex min-h-[52dvh] w-full items-center px-1 py-16 md:py-24">
      <div className="grid w-full grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <p className="mb-5 inline-flex rounded-full bg-main-text/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-text">
            {isFolder ? "This folder" : "Start here"}
          </p>
          <h2 className="text-[2.75rem] font-medium leading-[0.92] tracking-[-0.045em] text-main-text md:text-[4.5rem]">
            {isFolder ? "Folder Empty" : "No Files Yet"}
          </h2>
        </div>

        <div className="rounded-[2rem] bg-main-text/[0.04] p-2 ring-1 ring-main-text/[0.06]">
          <div className="flex flex-col items-start gap-8 rounded-[calc(2rem-0.5rem)] bg-panel-bg px-8 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            {isFolder ? <FolderIllustration /> : <UploadIllustration />}
            <p className="max-w-xs text-[15px] leading-relaxed tracking-[-0.01em] text-muted-text">
              {isFolder
                ? "Drop files here, or use upload above. They land in this folder."
                : "Drop files anywhere on this page, or use upload above. The library fills itself."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
