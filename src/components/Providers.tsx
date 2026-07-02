"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { AIPreferencesSaver } from "./AIPreferencesSaver";
import { ThemeProvider } from "./ThemeProvider";
import { ThemePreferencesSaver } from "./ThemePreferencesSaver";
import { ThemeAwareLayoutClient } from "./ThemeAwareLayoutClient";

export function Providers({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: "dark" | "light";
}) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
  <QueryClientProvider client={queryClient}>
  <SessionProvider>
  <MotionConfig reducedMotion="user">
  <AuthProvider>
  <ThemeProvider initialTheme={theme}>
  <AIPreferencesSaver />
  <ThemePreferencesSaver />
  {children}
  <ThemeAwareLayoutClient />
  </ThemeProvider>
  </AuthProvider>
  </MotionConfig>
  </SessionProvider>
  <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
  );
}
