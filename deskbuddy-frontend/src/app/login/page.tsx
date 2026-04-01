"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

// ── Security helpers ─────────────────────────────────────────────────────────

/** Strip HTML tags and common XSS patterns from any text input. */
function sanitize(value: string): string {
  return value
    .trim()
    .replace(/<[^>]*>/g, "")          // strip HTML tags
    .replace(/javascript:/gi, "")     // strip javascript: URIs
    .replace(/on\w+\s*=/gi, "");      // strip inline event handlers
}

export default function LoginPage() {
  const { login, register, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [mode,        setMode]        = useState<"login" | "register">("login");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [error,       setError]       = useState("");
  const [busy,        setBusy]        = useState(false);
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Already logged in → go home
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/");
  }, [isAuthenticated, isLoading, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate before hashing
    if (mode === "register") {
      if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
      if (password !== confirm) { setError("Passwords do not match."); return; }
    }

    setBusy(true);
    try {
      const cleanEmail = sanitize(email);

      if (mode === "login") {
        await login(cleanEmail, password);
      } else {
        await register(cleanEmail, password);
      }
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return null; // avoid flash before auth state is known

  return (
    <div className="min-h-screen bg-desk-wood dark:bg-desk-wood-dark flex items-center justify-center px-4">
      {/* Back to home */}
      <Link
        href="/"
        className="absolute top-4 left-4 flex items-center gap-1.5 font-pixel text-xs uppercase tracking-widest opacity-50 hover:opacity-90 transition-opacity dark:text-[#F5E6D3]"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Home
      </Link>
      {/* Card */}
      <div className="w-full max-w-sm bg-white/50 dark:bg-black/30 border-2 border-black/10 rounded-2xl pixel-shadow p-8 flex flex-col gap-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="size-12 flex items-center justify-center bg-camera-silver border-2 border-black/10 rounded-xl pixel-shadow">
            <span className="material-symbols-outlined text-2xl text-pixel-black">smart_toy</span>
          </div>
          <h1 className="font-pixel text-2xl uppercase tracking-widest text-pixel-black dark:text-[#F5E6D3]">
            Desk Buddy
          </h1>
          <p className="font-display text-sm opacity-50 dark:text-[#F5E6D3]">
            {mode === "login" ? "Welcome back!" : "Create your account"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl border-2 border-black/10 overflow-hidden">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-2 font-pixel text-xs uppercase tracking-widest transition-colors
                ${mode === m
                  ? "bg-primary/30 text-pixel-black dark:text-[#F5E6D3]"
                  : "text-black/40 dark:text-white/40 hover:bg-black/5"
                }`}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-pixel text-xs uppercase tracking-widest opacity-60 dark:text-[#F5E6D3]">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-white/60 dark:bg-black/20 border-2 border-black/10 rounded-lg px-3 py-2 font-display text-sm outline-none focus:border-primary/50 transition-colors dark:text-[#F5E6D3] placeholder:opacity-40"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-pixel text-xs uppercase tracking-widest opacity-60 dark:text-[#F5E6D3]">Password</span>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/60 dark:bg-black/20 border-2 border-black/10 rounded-lg px-3 py-2 pr-10 font-display text-sm outline-none focus:border-primary/50 transition-colors dark:text-[#F5E6D3] placeholder:opacity-40"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-black/50 dark:text-white/60 hover:text-black/80 dark:hover:text-white/90 transition-colors"
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPass ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </label>

          {mode === "register" && (
            <label className="flex flex-col gap-1">
              <span className="font-pixel text-xs uppercase tracking-widest opacity-60 dark:text-[#F5E6D3]">Confirm password</span>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/60 dark:bg-black/20 border-2 border-black/10 rounded-lg px-3 py-2 pr-10 font-display text-sm outline-none focus:border-primary/50 transition-colors dark:text-[#F5E6D3] placeholder:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-black/50 dark:text-white/60 hover:text-black/80 dark:hover:text-white/90 transition-colors"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showConfirm ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </label>
          )}

          {/* Error */}
          {error && (
            <p className="font-display text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 w-full py-2.5 bg-primary/30 hover:bg-primary/50 disabled:opacity-50 border-2 border-primary/40 rounded-xl font-pixel text-sm uppercase tracking-widest transition-colors pixel-shadow"
          >
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center font-display text-xs opacity-40 dark:text-[#F5E6D3]">
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="underline hover:opacity-80"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
