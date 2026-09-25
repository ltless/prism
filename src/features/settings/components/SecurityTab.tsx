"use client";

import { PasswordCard, VaultPinSection } from "./security/SecurityCards";

export function SecurityTab() {
  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-5">
      <div className="md:col-span-3">
        <PasswordCard />
      </div>
      <div className="md:col-span-2">
        <VaultPinSection />
      </div>
    </div>
  );
}
