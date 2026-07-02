"use client";

import { PasswordCard, VaultPinSection } from "./security/SecurityCards";

export function SecurityTab() {
  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-main-text">Security Settings</h3>
        <p className="text-[11px] text-muted-text">Configure your login credentials and vault protection.</p>
      </div>

      <PasswordCard />

      <VaultPinSection />
    </div>
  );
}