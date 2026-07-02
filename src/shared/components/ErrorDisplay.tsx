"use client";

import { Warning } from "@phosphor-icons/react";

interface ErrorDisplayProps {
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export default function ErrorDisplay({
  title,
  message,
  action,
}: ErrorDisplayProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-app-bg p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-rose-500/10 rounded-xl flex items-center justify-center mx-auto mb-6">
          <Warning size={32} weight="light" className="text-rose-500" />
        </div>
        <h1 className="text-lg text-main-text mb-2">{title}</h1>
        {message && (
          <p className="text-xs font-bold text-muted-text mb-6">{message}</p>
        )}
        {action}
      </div>
    </div>
  );
}
