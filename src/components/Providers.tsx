"use client";

import { useState } from "react";
import { LazyMotion, domAnimation } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider } from "@/lib/auth/AuthContext";
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
  <LazyMotion features={domAnimation} strict>
  <AuthProvider>
  <ThemeProvider initialTheme={theme}>
  <ThemePreferencesSaver />
  {children}
  <ThemeAwareLayoutClient />
  </ThemeProvider>
  </AuthProvider>
  </LazyMotion>
  <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
  );
}
