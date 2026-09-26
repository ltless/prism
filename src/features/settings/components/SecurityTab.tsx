"use client";

import { PasswordCard, VaultPinSection } from "./security/SecurityCards";
import { SettingsGroup } from "./SettingsGroup";

export function SecurityTab() {
  return (
    <div className="flex flex-col gap-6">
      <PasswordCard />
      <SettingsGroup title="Vault PIN" description="Required to open private media. Five wrong tries locks it for 15 minutes.">
        <VaultPinSection />
      </SettingsGroup>
    </div>
  );
}
