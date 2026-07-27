"use client";

import Link from "next/link";
import ErrorDisplay from "@/shared/components/ErrorDisplay";
export default function NotFound() {
  return (
    <ErrorDisplay
      title="Page Not Found"
      message="The page you're looking for doesn't exist"
      action={
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-primary/8 text-primary rounded text-[11px] font-medium hover:bg-primary/15 active:scale-[0.98] transition-all"
        >
          Back to Dashboard
        </Link>
      }
    />
  );
}
