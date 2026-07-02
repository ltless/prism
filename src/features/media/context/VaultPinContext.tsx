"use client";

import { createContext, useContext } from "react";

/**
 * Holds the verified vault PIN while the vault is unlocked. Server actions
 * forward it so the backend can enforce the PIN on un-vault operations.
 * Consumers outside an unlocked vault read null.
 */
const VaultPinContext = createContext<string | null>(null);

export function VaultPinProvider({
  pin,
  children,
}: {
  pin: string | null;
  children: React.ReactNode;
}) {
  return <VaultPinContext.Provider value={pin}>{children}</VaultPinContext.Provider>;
}

export function useVaultPin() {
  return useContext(VaultPinContext);
}
