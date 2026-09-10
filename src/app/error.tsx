"use client";

import ErrorDisplay from "@/shared/components/ErrorDisplay";
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorDisplay
      title="Critical Error"
      message={
        error.digest ? `Error ID: ${error.digest}` : "An unexpected error occurred"
      }
      action={
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 bg-primary/8 text-primary rounded-md text-[11px] font-medium hover:bg-primary/15 active:scale-[0.98] transition-[background-color,transform] cursor-pointer"
        >
          Reload
        </button>
      }
    />
  );
}
