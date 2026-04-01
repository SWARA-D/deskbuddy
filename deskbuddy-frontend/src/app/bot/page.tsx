"use client";

import DeskLayout from "@/components/layout/DeskLayout";
import BackButton from "@/components/ui/BackButton";
import { useState, useRef, useEffect } from "react";
import { botApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const BOT_HISTORY_KEY = "deskbuddy_bot_history";
const MAX_HISTORY     = 50;

const INITIAL_MSG = { role: "bot" as const, text: "Hey! I'm your Desk Buddy assistant. What can I help you with today?", id: "init" };

interface Msg {
  id: string;
  role: "user" | "bot";
  text: string;
  error?: boolean;
}

function loadHistory(): Msg[] {
  try {
    const stored = localStorage.getItem(BOT_HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Msg[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [INITIAL_MSG];
}

export default function BotPage() {
  const { isAuthenticated } = useAuth();

  const [messages, setMessages] = useState<Msg[]>([INITIAL_MSG]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load history from localStorage on mount (client-side only)
  useEffect(() => {
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (!hydrated) return;
    try {
      const toStore = messages.slice(-MAX_HISTORY);
      localStorage.setItem(BOT_HISTORY_KEY, JSON.stringify(toStore));
    } catch { /* ignore */ }
  }, [messages, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const clearChat = () => {
    const fresh = [INITIAL_MSG];
    setMessages(fresh);
    localStorage.removeItem(BOT_HISTORY_KEY);
  };

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);

    if (!isAuthenticated) {
      setMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, role: "bot", text: "🔒 Please log in to chat with me!", error: true },
      ]);
      setLoading(false);
      return;
    }

    try {
      const res = await botApi.message(trimmed);
      setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, role: "bot", text: res.data.reply }]);
    } catch (err: any) {
      // Graceful degradation — show a helpful fallback rather than a raw error
      const fallback = localFallback(trimmed);
      setMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, role: "bot", text: fallback, error: err.status === 429 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DeskLayout>
      <div className="max-w-2xl mx-auto pt-10 flex flex-col" style={{ height: "calc(100dvh - 160px)", minHeight: "300px" }}>
        <BackButton />

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-3xl uppercase tracking-widest text-pixel-black dark:text-[#F5E6D3]">
            Bot
          </h2>
          <button
            onClick={clearChat}
            className="font-pixel text-xs opacity-40 hover:opacity-80 transition-opacity uppercase tracking-wider"
            aria-label="Clear chat history"
          >
            Clear chat
          </button>
        </div>

        {/* Offline / unauthed notice */}
        {!isAuthenticated && (
          <div className="mb-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl font-display text-xs text-amber-700 dark:text-amber-300">
            You're not logged in — bot replies are limited to local responses.{" "}
            <a href="/login" className="underline font-semibold">Log in</a> for the full experience.
          </div>
        )}

        {/* Chat window */}
        <div role="log" aria-live="polite" className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 pb-2">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 pixel-shadow
                  ${m.role === "user"
                    ? "bg-primary/25 border border-primary/40 text-right"
                    : m.error
                      ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                      : "bg-white/50 dark:bg-black/30 border border-black/10"
                  }`}
              >
                <p className="font-display text-sm">{m.text}</p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/50 dark:bg-black/30 border border-black/10 rounded-xl px-4 py-3 pixel-shadow flex gap-1.5 items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-2 rounded-full bg-black/30 dark:bg-white/30 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-3 mt-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Tell me what to do…"
            disabled={loading}
            className="flex-1 bg-white/50 dark:bg-black/25 border-2 border-black/10 rounded-xl px-4 py-2.5 font-display text-base placeholder:opacity-40 dark:text-[#F5E6D3] outline-none focus:border-primary/40 transition-colors disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="size-10 bg-primary/30 hover:bg-primary/50 disabled:opacity-40 border border-primary/40 rounded-xl flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-primary">send</span>
          </button>
        </div>
      </div>
    </DeskLayout>
  );
}

/** Local fallback when API is unreachable — keeps the bot usable offline. */
function localFallback(input: string): string {
  const l = input.toLowerCase();
  if (l.includes("task"))                                return "📝 Head to the Focus page to manage your tasks!";
  if (l.includes("playlist") || l.includes("music"))    return "🎵 Check out the Music page — pick a mood and I'll find a playlist!";
  if (l.includes("journal") || l.includes("diary"))     return "📓 The Journal is waiting for you — go write something nice!";
  if (l.includes("streak"))                             return "🔥 Visit the Photos page to see your streak!";
  if (l.includes("checkin") || l.includes("check in"))  return "📸 Head to the Photo Booth for your daily check-in!";
  if (l.includes("hello") || l.includes("hi"))          return "👋 Hi! I'm your Desk Buddy. Try asking me about tasks, music, or your journal!";
  return "🤖 I didn't quite catch that. Try: 'add a task', 'suggest music', or 'show my streak'.";
}
