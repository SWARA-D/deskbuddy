"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("db-theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("db-theme", theme);
  }, [theme]);

  useEffect(() => {
    (window as any).__dbToggleTheme = () =>
      setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <html lang="en" className={`${theme} ${plusJakartaSans.variable} ${vt323.variable}`} suppressHydrationWarning>
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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
