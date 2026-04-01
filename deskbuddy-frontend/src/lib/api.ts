/**
 * Typed API client for the DeskBuddy FastAPI gateway.
 * Automatically attaches the JWT from localStorage.
 * On 401, clears the stored token and redirects to /login.
 */

import { getStoredToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("db:session-expired"));
    }
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  const body = await res.json().catch(() => ({ message: res.statusText }));

  if (!res.ok) {
    throw new ApiError(res.status, body.detail ?? body.message ?? `HTTP ${res.status}`);
  }

  return body as T;
}

// ── Typed response wrappers ────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  status_code: number;
}

// ── Journal ───────────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  text: string;
  input_type: string;
  created_at: string;
}

export interface JournalListItem {
  id: string;
  text_preview: string;
  created_at: string;
  has_analysis: boolean;
}

export const journalApi = {
  list: (limit = 20) =>
    request<ApiResponse<{ items: JournalListItem[]; next_cursor: null }>>(`/journal/entries?limit=${limit}`),

  get: (id: string) =>
    request<ApiResponse<{ entry: JournalEntry; analysis: any }>>(`/journal/entries/${id}`),

  create: (text: string, input_type: "typed" | "voice" = "typed", analyze = true) =>
    request<ApiResponse<{ entry: JournalEntry; analysis: any }>>("/journal/entries", {
      method: "POST",
      body: JSON.stringify({ text, input_type, analyze }),
    }),

  delete: (id: string) =>
    request<ApiResponse<{ deleted: boolean }>>(`/journal/entries/${id}`, { method: "DELETE" }),
};

// ── NLP ───────────────────────────────────────────────────────────────────

export interface NlpResult {
  sentiment: "positive" | "neutral" | "negative";
  emotion: string;
  confidence: number;
  model_version: string;
}

export const nlpApi = {
  analyze: (text: string, entry_id?: string) =>
    request<ApiResponse<NlpResult>>("/nlp/analyze", {
      method: "POST",
      body: JSON.stringify({ text, entry_id }),
    }),
};

// ── Tasks ─────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  due_at: string;
  status: "todo" | "in_progress" | "done";
}

export const tasksApi = {
  list: () =>
    request<ApiResponse<{ items: Task[] }>>("/tasks"),

  create: (title: string, due_at: string, category?: string, difficulty = 1) =>
    request<ApiResponse<{ task: Task }>>("/tasks", {
      method: "POST",
      body: JSON.stringify({ title, due_at, category, difficulty }),
    }),

  update: (id: string, patch: { status?: string; title?: string }) =>
    request<ApiResponse<{ task: Task }>>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
};

// ── Checkins ──────────────────────────────────────────────────────────────

export interface Streak {
  current: number;
  longest: number;
  last_checkin_date: string | null;
}

export interface CalendarItem {
  checkin_date: string;
  caption: string | null;
}

export const checkinApi = {
  create: (checkin_date: string, caption?: string) =>
    request<ApiResponse<{ checkin_date: string; streak: Streak }>>("/checkins", {
      method: "POST",
      body: JSON.stringify({ checkin_date, caption }),
    }),

  streak: () =>
    request<ApiResponse<Streak>>("/checkins/streak"),

  calendar: () =>
    request<ApiResponse<{ items: CalendarItem[] }>>("/checkins/calendar"),
};

// ── Bot ───────────────────────────────────────────────────────────────────

export interface BotResponse {
  intent: string;
  actions_taken: string[];
  reply: string;
}

export const botApi = {
  message: (message: string) =>
    request<ApiResponse<BotResponse>>("/bot/message", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

// ── Music ─────────────────────────────────────────────────────────────────

export const musicApi = {
  recommendations: (mood: string) =>
    request<ApiResponse<{ mood: string; items: { title: string; type: string; spotify_url: string }[] }>>(
      `/music/recommendations?mood=${encodeURIComponent(mood)}`
    ),
};
