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
          onClick={reset}
          className="px-6 py-3 bg-primary/10 text-primary rounded-2xl text-xs hover:bg-primary/20 transition-colors cursor-pointer"
        >
          Try Again
        </button>
      }
    />
  );
}
