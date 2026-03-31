"use client";

/**
 * Auth context — JWT management for the DeskBuddy app.
 *
 * Auth flow:
 *   - login/register call the Next.js BFF routes (/api/auth/*), which set an
 *     httpOnly cookie with the JWT. The cookie is used by all same-origin
 *     Next.js API routes and cannot be read by JavaScript (XSS-proof).
 *   - The JWT is ALSO stored in localStorage so that api.ts can include it in
 *     Authorization headers for direct FastAPI calls (cross-origin requests
 *     don't send same-site cookies).
 *   - User metadata (id, email) is stored in localStorage for display only.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";

// BFF routes — same origin, set httpOnly cookie on success
const AUTH_LOGIN_URL    = "/api/auth/login";
const AUTH_REGISTER_URL = "/api/auth/register";
const AUTH_LOGOUT_URL   = "/api/auth/logout";

const TOKEN_KEY      = "db-token";
const USER_KEY       = "db-user";
const REFRESH_LEAD_S = 120; // refresh 2 minutes before expiry

/** Decode the `exp` claim from a JWT without verifying the signature.
 *
 * NOTE: this is used ONLY to schedule the silent refresh timer, not for any
 * access-control decision (that happens server-side).  We clamp the returned
 * value to at most 24 hours from now so a token with a crafted far-future exp
 * cannot push the refresh indefinitely into the future.
 */
function decodeJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp !== "number") return null;
    const maxExp = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 h ceiling
    return Math.min(payload.exp, maxExp);
  } catch {
    return null;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [token,     setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Schedule a silent token refresh ~2 minutes before the JWT expires.
   * The BFF /api/auth/refresh route reads the httpOnly cookie, exchanges it
   * with FastAPI, writes a new cookie, and returns the new access_token.
   */
  const scheduleRefresh = useCallback((tok: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const exp = decodeJwtExp(tok);
    if (!exp) return;
    const msUntilRefresh = (exp - REFRESH_LEAD_S) * 1000 - Date.now();
    if (msUntilRefresh <= 0) return; // already expired / too close
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (res.ok) {
          const body     = await res.json();
          const newToken = body.data?.access_token;
          if (newToken) {
            localStorage.setItem(TOKEN_KEY, newToken);
            setToken(newToken);
            scheduleRefresh(newToken); // chain the next refresh
          }
        }
      } catch {
        // Silent fail — user will be redirected to /login when the token expires
      }
    }, msUntilRefresh);
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser  = localStorage.getItem(USER_KEY);
      if (savedToken && savedUser) {
        const u = JSON.parse(savedUser) as AuthUser;
        setToken(savedToken);
        setUser(u);
        scheduleRefresh(savedToken);
      }
    } catch {
      // Corrupted localStorage — clear it
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [scheduleRefresh]);

  const _persist = (t: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
    scheduleRefresh(t);
  };

  const login = useCallback(async (email: string, password: string) => {
    // BFF route: proxies to FastAPI and sets the httpOnly cookie server-side.
    const res = await fetch(AUTH_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail ?? body.message ?? "Login failed");
    // httpOnly cookie is set by the server; also persist to localStorage so
    // api.ts can include it in Authorization headers for direct FastAPI calls.
    _persist(body.data.tokens.access_token, body.data.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(AUTH_REGISTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail ?? body.message ?? "Registration failed");
    _persist(body.data.tokens.access_token, body.data.user);
  }, []);

  const logout = useCallback(async () => {
    // Cancel any pending refresh timer
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Clear the httpOnly cookie via the BFF route.
    await fetch(AUTH_LOGOUT_URL, { method: "POST" }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token,
      isLoading,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Returns the stored JWT without subscribing to re-renders — for use outside React. */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
