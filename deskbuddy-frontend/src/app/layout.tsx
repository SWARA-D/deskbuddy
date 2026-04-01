import "./globals.css";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { VT323, Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

/**
 * Root layout — Server Component.
 *
 * Theme state is managed by <ThemeProvider> (client component) which
 * applies the "light" / "dark" class to <html> on mount and listens for
 * "db:toggle-theme" CustomEvents. This replaces the old window.__dbToggleTheme
 * global, and makes this file a Server Component so Next.js can propagate the
 * per-request nonce (set by middleware) to its generated scripts.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${vt323.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Desk Buddy</title>
        <meta
          name="description"
          content="A lightweight desk-style companion for journaling, mood check-ins, music, and micro-tasks."
        />
        {/* Material Symbols icon font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="bg-desk-wood dark:bg-desk-wood-dark font-display text-[#2C241B] dark:text-[#F5E6D3] selection:bg-primary/30 overflow-hidden transition-colors duration-300">
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
