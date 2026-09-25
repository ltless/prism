import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const geistSans = Geist({
 variable: "--font-geist-sans",
 subsets: ["latin"],
});

const geistMono = Geist_Mono({
 variable: "--font-geist-mono",
 subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prism v2 // Private Media Intelligence",
  description: "Advanced local-first media management and intelligence platform.",
  applicationName: "Prism",
  appleWebApp: {
    capable: true,
    title: "Prism",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
  ],
};

import { Providers } from "@/components/Providers";

export default async function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 const cookieStore = await cookies();
 const rawTheme = cookieStore.get("prism-theme")?.value;
 const theme = rawTheme === "light" || rawTheme === "dark" ? rawTheme : "dark";

 return (
 <html
 lang="en"
 data-theme={theme}
 data-scroll-behavior="smooth"
 className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
 >
  <body className="min-h-full flex flex-col">
  <a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-skip-link focus:px-4 focus:py-2 focus:bg-panel-bg focus:text-main-text focus:border focus:border-main-border focus:rounded-lg"
  >
  Skip to content
  </a>
  <Providers theme={theme}>
   {children}
  </Providers>
  <div id="modal-root" />
  </body>
 </html>
 );
}
