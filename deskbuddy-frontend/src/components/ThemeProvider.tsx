"use client";

import { useEffect, useState } from "react";

/**
 * Client-side theme manager.
 *
 * Reads the saved theme from localStorage on mount, applies it to
 * <html> via classList, and listens for "db:toggle-theme" CustomEvents
 * dispatched by the Header (replaces the old window.__dbToggleTheme global).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Initialise from localStorage or system preference
  useEffect(() => {
    const saved = localStorage.getItem("db-theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    } else {
      setTheme(
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      );
    }
  }, []);

  // Persist and apply the theme class to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("light", "dark");
    html.classList.add(theme);
    localStorage.setItem("db-theme", theme);
  }, [theme]);

  // Listen for toggle events dispatched by Header or any other component
  useEffect(() => {
    const handler = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    window.addEventListener("db:toggle-theme", handler);
    return () => window.removeEventListener("db:toggle-theme", handler);
  }, []);

  return <>{children}</>;
}
