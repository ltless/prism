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
          className="inline-block px-6 py-3 bg-primary/10 text-primary rounded-2xl text-xs hover:bg-primary/20 transition-all duration-300 ease-out-expo"
        >
          Back to Dashboard
        </Link>
      }
    />
  );
}
