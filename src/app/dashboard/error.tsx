"use client";

import ErrorDisplay from "@/shared/components/ErrorDisplay";
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorDisplay
      title="Library Error"
      message={
        error.digest
          ? `Error ID: ${error.digest}`
          : "Something went wrong loading the library"
      }
      action={
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 bg-primary/8 text-primary rounded text-[11px] font-medium hover:bg-primary/15 active:scale-[0.98] transition-all cursor-pointer"
        >
          Try Again
        </button>
      }
    />
  );
}
