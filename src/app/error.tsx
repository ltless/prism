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
          onClick={reset}
          className="px-6 py-3 bg-primary/10 text-primary rounded-2xl text-xs hover:bg-primary/20 transition-all duration-300 ease-out-expo cursor-pointer"
        >
          Reload Application
        </button>
      }
    />
  );
}
