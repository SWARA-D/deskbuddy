"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const [isDark,   setIsDark]   = useState(false);
  const [toast,    setToast]    = useState(false);

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    window.dispatchEvent(new CustomEvent("db:toggle-theme"));
  };

  const handleLogout = async () => {
    await logout();        // clear cookie + localStorage
    setToast(true);        // show "logged out" toast
    setTimeout(() => {
      window.location.href = "/login";  // full reload so cookie is gone before middleware runs
    }, 1800);
  };

  return (
    <header className="flex items-center justify-between border-b border-black/5 bg-white/30 dark:bg-black/20 backdrop-blur-md px-4 sm:px-6 lg:px-10 py-2 sm:py-3 z-50 relative">
      {/* ── left: logo + nav ── */}
      <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 lg:gap-4 text-[#2C241B] dark:text-[#F5E6D3] hover:opacity-80 transition-opacity">
          <div className="size-6 sm:size-7 lg:size-8 flex items-center justify-center bg-camera-silver border-2 border-black/10 rounded-lg pixel-shadow">
            <span className="material-symbols-outlined text-xs sm:text-sm text-pixel-black">smart_toy</span>
          </div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-pixel tracking-wider uppercase">Desk Buddy</h1>
        </Link>

        <nav className="hidden md:flex items-center gap-6 lg:gap-9">
          <Link href="/tasks"   className="text-sm lg:text-lg font-pixel tracking-widest uppercase hover:text-ipod-blue transition-colors">Focus</Link>
          <Link href="/music"   className="text-sm lg:text-lg font-pixel tracking-widest uppercase hover:text-ipod-blue transition-colors">Music</Link>
          <Link href="/journal" className="text-sm lg:text-lg font-pixel tracking-widest uppercase hover:text-ipod-blue transition-colors">Journal</Link>
          <Link href="/checkin" className="text-sm lg:text-lg font-pixel tracking-widest uppercase hover:text-ipod-blue transition-colors">Photos</Link>
          <Link href="/bot"     className="text-sm lg:text-lg font-pixel tracking-widest uppercase hover:text-ipod-blue transition-colors">Bot</Link>
        </nav>
      </div>

      {/* ── right: search + user + theme ── */}
      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
        {/* search box */}
        <div className="hidden sm:flex items-center border-2 border-black/10 bg-white/40 dark:bg-black/20 rounded-lg px-2 sm:px-3 h-8 sm:h-10 pixel-shadow">
          <span className="material-symbols-outlined text-base sm:text-lg opacity-50">search</span>
          <input
            type="text"
            placeholder="Look around..."
            className="bg-transparent border-none outline-none font-pixel text-sm sm:text-lg w-24 sm:w-32 lg:w-40 placeholder:opacity-50 dark:text-white ml-2"
          />
        </div>

        {/* user badge + logout */}
        {isAuthenticated && user && (
          <div className="flex items-center gap-2">
            <span
              title={user.email}
              className="hidden sm:block font-pixel text-xs uppercase tracking-widest opacity-60 dark:text-[#F5E6D3] max-w-[120px] truncate"
            >
              {user.email.split("@")[0]}
            </span>
            <button
              onClick={handleLogout}
              title="Log out"
              className="flex items-center gap-1.5 px-2 sm:px-3 h-8 sm:h-9 bg-white/40 dark:bg-black/20 border-2 border-black/10 rounded-lg pixel-shadow hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
            >
              <span className="material-symbols-outlined text-base sm:text-lg">logout</span>
              <span className="font-pixel text-xs uppercase tracking-widest">Log out</span>
            </button>
          </div>
        )}

        {/* login link if not authenticated */}
        {!isAuthenticated && (
          <Link
            href="/login"
            className="hidden sm:flex items-center gap-1 font-pixel text-xs uppercase tracking-widest px-3 py-1.5 bg-primary/20 hover:bg-primary/40 border-2 border-primary/30 rounded-lg transition-colors pixel-shadow"
          >
            Log in
          </Link>
        )}

        {/* theme toggle */}
        <button
          onClick={toggle}
          className="size-8 sm:size-9 lg:size-10 bg-white/40 dark:bg-black/20 border-2 border-black/10 rounded-lg flex items-center justify-center pixel-shadow hover:bg-white/60 dark:hover:bg-black/40 transition-all"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span className="material-symbols-outlined text-base sm:text-lg">
            {isDark ? "dark_mode" : "light_mode"}
          </span>
        </button>

        {/* settings (placeholder) */}
        <button
          className="size-8 sm:size-9 lg:size-10 bg-white/40 dark:bg-black/20 border-2 border-black/10 rounded-lg flex items-center justify-center pixel-shadow hover:bg-white/60 dark:hover:bg-black/40 transition-all"
          title="Settings"
        >
          <span className="material-symbols-outlined text-base sm:text-lg">settings</span>
        </button>
      </div>
      {/* ── logout toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 px-5 py-3 bg-pixel-black dark:bg-[#F5E6D3] text-[#F5E6D3] dark:text-pixel-black border-2 border-black/20 rounded-xl pixel-shadow animate-fade-in">
          <span className="material-symbols-outlined text-base">logout</span>
          <span className="font-pixel text-xs uppercase tracking-widest">You have been logged out</span>
        </div>
      )}
    </header>
  );
}
