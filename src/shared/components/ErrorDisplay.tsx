"use client";

import { Warning } from "@phosphor-icons/react";
interface ErrorDisplayProps {
  title: string;
  message?: string;
  action?: React.ReactNode;
}
export default function ErrorDisplay({ title, message, action }: ErrorDisplayProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-app-bg p-6">
      <div className="text-center max-w-sm">
        <div className="w-10 h-10 bg-rose-500/8 rounded flex items-center justify-center mx-auto mb-4">
          <Warning size={20} weight="light" className="text-rose-500" />
        </div>
        <h1 className="text-sm font-medium text-main-text mb-1.5">{title}</h1>
        {message && (
          <p className="text-[11px] text-muted-text mb-5">{message}</p>
        )}
        {action}
      </div>
    </div>
  );
}
