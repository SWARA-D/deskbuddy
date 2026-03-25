"use client";

/**
 * Auth context — JWT management for the DeskBuddy FastAPI backend.
 * Stores token + user in localStorage. Exposes login, register, logout.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const TOKEN_KEY  = "db-token";
const USER_KEY   = "db-user";
const DEMO_EMAIL = "demo@deskbuddy.app";
const DEMO_SEEDED_KEY = "deskbuddy_demo_seeded_v2";

function seedDemoData() {
  if (localStorage.getItem(DEMO_SEEDED_KEY)) return;
  const now   = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  function daysAgo(n: number) {
    const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
  }
  localStorage.setItem("deskbuddy_habits", JSON.stringify([
    { id: now+1, name: "Drink 8 glasses of water",   category: "health",     createdAt: new Date(now - 86400000*20).toISOString() },
    { id: now+2, name: "Read 20 pages",               category: "learning",   createdAt: new Date(now - 86400000*18).toISOString() },
    { id: now+3, name: "10-min morning stretch",      category: "health",     createdAt: new Date(now - 86400000*15).toISOString() },
    { id: now+4, name: "No phone first 30 mins",      category: "confidence", createdAt: new Date(now - 86400000*10).toISOString() },
    { id: now+5, name: "Spanish flashcards (15 min)", category: "learning",   createdAt: new Date(now - 86400000*7).toISOString()  },
  ]));
  localStorage.setItem("deskbuddy_goals", JSON.stringify([
    { id: now+10, title: "Run a 5K without stopping",       category: "health",     dueAt: "2026-05-01", done: false, createdAt: new Date(now - 86400000*21).toISOString() },
    { id: now+11, title: "Finish online design course",     category: "learning",   dueAt: "2026-04-15", done: false, createdAt: new Date(now - 86400000*14).toISOString() },
    { id: now+12, title: "Save $500 this month",            category: "confidence", dueAt: "2026-03-31", done: false, createdAt: new Date(now - 86400000*10).toISOString() },
    { id: now+13, title: "Go one week without social media",category: "confidence", dueAt: "2026-04-01", done: true,  createdAt: new Date(now - 86400000*8).toISOString()  },
    { id: now+14, title: "Cook a new recipe every week",    category: "social",     dueAt: "2026-06-01", done: false, createdAt: new Date(now - 86400000*5).toISOString()  },
  ]));
  localStorage.setItem("deskbuddy_tasks", JSON.stringify([
    { id: now+20, title: "Morning run (20 min)",               category: "health",     difficulty: 1, dueAt: today,          status: "done" },
    { id: now+21, title: "Finish project proposal",            category: "work",       difficulty: 3, dueAt: today,          status: "todo" },
    { id: now+22, title: "Call dentist to book appointment",   category: "health",     difficulty: 1, dueAt: today,          status: "todo" },
    { id: now+23, title: "Read 20 pages",                      category: "learning",   difficulty: 1, dueAt: daysAgo(-1),    status: "todo" },
    { id: now+24, title: "Meal prep for the week",             category: "health",     difficulty: 2, dueAt: daysAgo(-1),    status: "todo" },
    { id: now+25, title: "Reply to pending emails",            category: "work",       difficulty: 1, dueAt: daysAgo(-2),    status: "todo" },
    { id: now+26, title: "Review Spanish flashcards (15 min)", category: "learning",   difficulty: 1, dueAt: daysAgo(-3),    status: "todo" },
    { id: now+27, title: "Deep clean desk + workspace",        category: "confidence", difficulty: 2, dueAt: daysAgo(-5),    status: "todo" },
  ]));
  function makeAnalysis(sentiment: string, emotion: string, confidence: number, mood_summary: string) {
    return JSON.stringify({
      mood: { sentiment, emotion, confidence, mood_summary, habits_to_highlight: [], suggested_tasks: [], _source: "keyword" },
      aiTodos: [], aiHabitIds: [], habitDoneToday: [],
    });
  }
  const journal = [
    { date: daysAgo(21), text: "First day properly using this app. Setting some intentions for the month — want to be more consistent with journaling, drink more water, and actually go to bed before midnight.", analysis: makeAnalysis("positive", "calm",    0.61, "Reflective and calm start to the month.")           },
    { date: daysAgo(17), text: "Completely crashed today. Slept through my alarm, missed a meeting, spent the afternoon trying to catch up. I hate days like this. Everything just piles on.",                 analysis: makeAnalysis("negative", "anxious", 0.82, "Overwhelmed and frustrated — high-stress day.")     },
    { date: daysAgo(14), text: "Decent morning. Made coffee before touching my phone which felt like a win. Did a 20 min walk. Not every day has to be a masterpiece I guess.",                               analysis: makeAnalysis("positive", "calm",    0.58, "Grounded and gently optimistic.")                   },
    { date: daysAgo(11), text: "Had a long video call with my sister. We laughed so much. I forget how much I need that. Feeling lighter than I have all week.",                                              analysis: makeAnalysis("positive", "excited", 0.79, "Joyful and recharged — connection helped a lot.")    },
    { date: daysAgo(7),  text: "Can't shake this low feeling. Nothing is technically wrong but I just feel kind of empty. Going to try to get to bed early and hope tomorrow is better.",                     analysis: makeAnalysis("negative", "sad",     0.74, "Quiet sadness — needs rest and patience.")             },
    { date: daysAgo(4),  text: "i am okay. i have to go for a walk tomorrow",                                                                                                                                analysis: makeAnalysis("neutral",  "neutral", 0.52, "Flat but stable — small intention set.")             },
    { date: daysAgo(2),  text: "Really good day. Finished the thing I've been procrastinating on for two weeks. Treated myself to takeout. Brain feels clear. This is what I want more of.",                 analysis: makeAnalysis("positive", "excited", 0.88, "Accomplished and satisfied — productive momentum.") },
  ];
  for (const e of journal) {
    localStorage.setItem(`deskbuddy_draft_${e.date}`,    e.text);
    localStorage.setItem(`deskbuddy_analysis_${e.date}`, e.analysis);
  }
  localStorage.setItem(DEMO_SEEDED_KEY, "1");
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

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser  = localStorage.getItem(USER_KEY);
      if (savedToken && savedUser) {
        const u = JSON.parse(savedUser) as AuthUser;
        setToken(savedToken);
        setUser(u);
        if (u.email === DEMO_EMAIL) seedDemoData();
      }
    } catch {
      // Corrupted localStorage — clear it
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const _persist = (t: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
    if (u.email === DEMO_EMAIL) seedDemoData();
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail ?? body.message ?? "Login failed");
    _persist(body.data.tokens.access_token, body.data.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail ?? body.message ?? "Registration failed");
    _persist(body.data.tokens.access_token, body.data.user);
  }, []);

  const logout = useCallback(() => {
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
