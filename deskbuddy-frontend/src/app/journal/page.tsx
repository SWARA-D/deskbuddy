"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DeskLayout from "@/components/layout/DeskLayout";
import BackButton from "@/components/ui/BackButton";
import Toast from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { getMoodConfig, emotionToMusicMood } from "@/constants/moods";
import {
  getHabits, getGoals, toggleGoal as storageToggleGoal,
} from "@/lib/storage";
import type { Habit as StorageHabit, Goal as StorageGoal } from "@/lib/storage";
import { getStoredToken } from "@/lib/auth";
import type { MoodResult, JournalEntry } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const getToday = () => new Date().toISOString().slice(0, 10);

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function displayDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function draftKey(date: string)     { return `deskbuddy_draft_${date}`; }
function analysisKey(date: string)  { return `deskbuddy_analysis_${date}`; }
function habitDoneKey(date: string) { return `deskbuddy_habit_done_${date}`; }

// ── Local types ───────────────────────────────────────────────────────────────

interface Todo {
  id: number | string;
  text: string;
  done: boolean;
  aiSuggested?: boolean;
}

interface Snapshot {
  id: string;
  image: string;  // base64
  emotion: string;
  caption: string;
  date: string;   // YYYY-MM-DD
  createdAt: string;
}

const PINNED_KEY = "deskbuddy_pinned";

function getPinnedIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) ?? "[]")); }
  catch { return new Set(); }
}

// ── Memories grid ─────────────────────────────────────────────────────────────

function MemoriesGrid({ date }: { date: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [lightbox,  setLightbox]  = useState<Snapshot | null>(null);

  useEffect(() => {
    try {
      const all: Snapshot[]  = JSON.parse(localStorage.getItem("deskbuddy_snapshots") ?? "[]");
      const pinned           = getPinnedIds();
      const forDate          = all.filter((s) => s.date === date);
      // Pinned first (up to 3), then the rest
      const pinnedSnaps      = forDate.filter((s) => pinned.has(s.id)).slice(0, 3);
      const unpinned         = forDate.filter((s) => !pinned.has(s.id));
      setSnapshots([...pinnedSnaps, ...unpinned]);
    } catch {
      setSnapshots([]);
    }
  }, [date]);

  const shown   = snapshots.slice(0, 4);
  const hasMore = snapshots.length > 4;

  return (
    <>
      {snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-3 opacity-30 text-center">
          <span className="material-symbols-outlined text-2xl">photo_camera</span>
          <p className="font-pixel text-xs">No memories yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {shown.map((s) => (
            <button
              key={s.id}
              onClick={() => setLightbox(s)}
              className="aspect-square overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity relative"
              style={{ background: "#f5f5f5" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image} alt={s.caption || s.emotion} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* See All / collapse + add photo row */}
      <div className="flex items-center justify-between mt-2">
        <Link
          href="/checkin"
          className="font-pixel text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          + Add
        </Link>
        {hasMore && (
          <Link
            href="/checkin"
            className="font-pixel text-xs px-2 py-0.5 text-gray-600 hover:text-gray-900 transition-colors"
            style={{ border: "1.5px solid #ccc" }}
          >
            See all {snapshots.length}
          </Link>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setLightbox(null); }}
        >
          <div
            className="relative bg-white p-3 max-w-sm w-full"
            style={{ border: "4px solid #292929", boxShadow: "6px 6px 0 rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.image} alt={lightbox.caption} className="w-full object-contain max-h-64" loading="lazy" />
            <div className="mt-2 font-pixel text-sm text-gray-700">
              <span className="text-base">{lightbox.emotion}</span>
              {lightbox.caption && <span className="ml-2 text-gray-500">— {lightbox.caption}</span>}
            </div>
            <p className="font-pixel text-xs text-gray-400 mt-1">{displayDate(lightbox.date)}</p>
            <button
              autoFocus
              onClick={() => setLightbox(null)}
              className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
              aria-label="Close lightbox"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const router = useRouter();
  const { toast, toastVisible, showToast } = useToast();

  // ── Date navigation ────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(getToday());
  const dateInputRef = useRef<HTMLInputElement>(null);

  // ── Entry state ────────────────────────────────────────────────────────
  const [entryText,    setEntryText]    = useState("");
  const [wordCount,    setWordCount]    = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [draftSaved,   setDraftSaved]   = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [analyzing,    setAnalyzing]    = useState(false);
  const [analyzed,     setAnalyzed]     = useState(false);
  const [panelTab,     setPanelTab]     = useState<"write" | "sidebar">("write");
  const [mood,         setMood]         = useState<MoodResult | null>(null);
  const [aiTodos,      setAiTodos]      = useState<Todo[]>([]);
  const [newTodoText,  setNewTodoText]  = useState("");

  // ── Habits & goals ─────────────────────────────────────────────────────
  const [userHabits,     setUserHabits]     = useState<StorageHabit[]>([]);
  const [userGoals,      setUserGoals]      = useState<StorageGoal[]>([]);
  const [habitDoneToday, setHabitDoneToday] = useState<Set<number>>(new Set());
  const [aiHabitIds,     setAiHabitIds]     = useState<Set<number>>(new Set());

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Refresh habits/goals on focus ──────────────────────────────────────
  const refreshStorage = useCallback(() => {
    setUserHabits(getHabits());
    setUserGoals(getGoals());
  }, []);

  useEffect(() => {
    refreshStorage();
    window.addEventListener("focus", refreshStorage);
    return () => window.removeEventListener("focus", refreshStorage);
  }, [refreshStorage]);

  // ── Load entry for the current date ────────────────────────────────────
  const loadEntryForDate = useCallback(async (date: string) => {
    setEntryText("");
    setAnalyzed(false);
    setMood(null);
    setAiTodos([]);
    setHabitDoneToday(new Set());
    setAiHabitIds(new Set());
    setDraftSaved(false);
    setPanelTab("write");

    setLoadingEntry(true);

    // Restore analysis from localStorage.
    const savedAnalysis = localStorage.getItem(analysisKey(date));
    if (savedAnalysis) {
      try {
        const data = JSON.parse(savedAnalysis) as {
          mood: MoodResult; aiTodos: Todo[];
          aiHabitIds: number[]; habitDoneToday: number[];
        };
        setMood(data.mood);
        setAiTodos(data.aiTodos);
        setAiHabitIds(new Set(data.aiHabitIds));
        // habitDoneToday from analysis is a fallback; user's manual state takes priority below
        setHabitDoneToday(new Set(data.habitDoneToday ?? []));
        setAnalyzed(true);
      } catch { /* ignore */ }
    }

    // User's manually-saved habit state always wins over the analysis snapshot.
    const savedHabitDone = localStorage.getItem(habitDoneKey(date));
    if (savedHabitDone) {
      try { setHabitDoneToday(new Set(JSON.parse(savedHabitDone) as number[])); }
      catch { /* ignore */ }
    }

    // Always restore local draft first (instant, no flicker).
    const draft = localStorage.getItem(draftKey(date));
    if (draft) setEntryText(draft);

    // Skip API fetch when the local draft was saved very recently (< 60 s).
    const draftTs  = localStorage.getItem(`deskbuddy_draft_ts_${date}`);
    const draftAge = draftTs ? Date.now() - parseInt(draftTs) : Infinity;
    if (draftAge < 60_000) {
      setLoadingEntry(false);
      return; // fresh local draft — skip API call
    }

    // Then try API — overwrite with server copy if found.
    try {
      const token = getStoredToken();
      const res = await fetch(`/api/journal/entries?date=${date}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json() as { entry: JournalEntry | null };
        if (data.entry && data.entry.text && data.entry.text !== "(entry cleared)") {
          setEntryText(data.entry.text);
          // Keep local draft in sync so next navigation also works.
          localStorage.setItem(draftKey(date), data.entry.text);
          if (!savedAnalysis && data.entry.emotion && data.entry.sentiment) {
            setMood({
              sentiment:    data.entry.sentiment as MoodResult["sentiment"],
              emotion:      data.entry.emotion,
              confidence:   data.entry.confidence ?? 0,
              mood_summary: data.entry.mood_summary ?? "",
              habits_to_highlight: [],
              suggested_tasks:     [],
              _source: "keyword",
            });
            setAnalyzed(true);
          }
        }
      }
    } catch { /* keep draft */ }

    setLoadingEntry(false);
  }, []);

  useEffect(() => {
    loadEntryForDate(currentDate);
  }, [currentDate, loadEntryForDate]);

  // ── Word count ─────────────────────────────────────────────────────────
  useEffect(() => {
    setWordCount(entryText.trim() === "" ? 0 : entryText.trim().split(/\s+/).length);
  }, [entryText]);

  // ── Draft autosave ─────────────────────────────────────────────────────
  useEffect(() => {
    // When text is cleared entirely, remove the draft immediately.
    if (entryText === "") {
      localStorage.removeItem(draftKey(currentDate));
      setDraftSaved(false);
      return;
    }
    if (entryText.length < 5) return;
    setDraftSaved(false);
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey(currentDate), entryText);
      localStorage.setItem(`deskbuddy_draft_ts_${currentDate}`, Date.now().toString());
      setDraftSaved(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [entryText, currentDate]);

  // ── Date navigation ────────────────────────────────────────────────────
  const goToDate = (offset: number) => {
    const [y, m, d] = currentDate.split("-").map(Number);
    const next = new Date(y, m - 1, d);
    next.setDate(next.getDate() + offset);
    setCurrentDate(toYMD(next));
  };

  // ── Save to API ────────────────────────────────────────────────────────
  const saveToAPI = async (text: string, moodResult: MoodResult | null): Promise<boolean> => {
    if (!text.trim()) return false;
    // Always persist locally so the entry is never lost if the DB is unavailable.
    localStorage.setItem(draftKey(currentDate), text);
    try {
      const token = getStoredToken();
      const res = await fetch("/api/journal/entries", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text,
          input_type: "typed",
          date: currentDate,
          ...(moodResult ? {
            sentiment:    moodResult.sentiment,
            emotion:      moodResult.emotion,
            confidence:   moodResult.confidence,
            mood_summary: moodResult.mood_summary,
          } : {}),
        }),
      });
      if (!res.ok) return false;
      // Keep draft in localStorage as a local copy — so navigating away
      // and back still restores the text if the in-memory API is cold.
      localStorage.setItem(draftKey(currentDate), text);
      setDraftSaved(false);
      return true;
    } catch {
      return false;
    }
  };

  // ── Analyze ────────────────────────────────────────────────────────────
  const canAnalyze = wordCount >= 5 && !analyzing;

  const analyzeEntry = async () => {
    if (entryText.trim().length < 5) return;
    setAnalyzing(true);
    try {
      const token = getStoredToken();
      const res = await fetch("/api/analyze", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: entryText }),
      });

      if (res.status === 503) {
        const d = await res.json() as { error?: string };
        showToast(`⏳ ${d.error ?? "Model warming up, try again soon"}`);
        return;
      }
      if (!res.ok) throw new Error(`API ${res.status}`);

      const result: MoodResult = await res.json();
      setMood(result);

      const suggested     = result.habits_to_highlight ?? [];
      const currentHabits = getHabits();
      const matchedIds    = new Set(
        currentHabits
          .filter((h) => suggested.some((s) => s.toLowerCase().includes(h.name.toLowerCase().split(" ")[0])))
          .map((h) => h.id)
      );
      setAiHabitIds(matchedIds);
      // Do NOT auto-check habits — only mark them with the ✦ indicator.
      // The user controls their own habit checkboxes.

      const newTodos = (result.suggested_tasks ?? []).map((text, i) => ({
        id: `ai-${Date.now()}-${i}`, text, done: false, aiSuggested: true,
      }));
      // Keep manually-added todos, replace only AI-suggested ones
      setAiTodos((prev) => [...prev.filter((t) => !t.aiSuggested), ...newTodos]);
      setAnalyzed(true);

      const mergedTodos = [...aiTodos.filter((t) => !t.aiSuggested), ...newTodos];
      localStorage.setItem(analysisKey(currentDate), JSON.stringify({
        mood:           result,
        aiTodos:        mergedTodos,
        aiHabitIds:     [...matchedIds],
        habitDoneToday: [...habitDoneToday],
      }));

      setSaving(true);
      const saved = await saveToAPI(entryText, result);
      setSaving(false);
      showToast(saved ? "✦ Analyzed & saved!" : "✦ Analysis complete! (saved locally)");
    } catch {
      showToast("⚠ Analysis failed — check console");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────
  const saveEntry = async () => {
    if (!entryText.trim()) { showToast("✦ Nothing to save yet!"); return; }
    setSaving(true);
    const saved = await saveToAPI(entryText, mood);
    setSaving(false);
    showToast(saved ? "✦ Entry saved!" : "✦ Saved locally!");
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const toggleHabitDone = (id: number) =>
    setHabitDoneToday((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(habitDoneKey(currentDate), JSON.stringify([...next]));
      return next;
    });

  const toggleAiTodo = (id: number | string) =>
    setAiTodos((p) => p.map((t) => t.id === id ? { ...t, done: !t.done } : t));

  const addManualTodo = () => {
    const text = newTodoText.trim();
    if (!text) return;
    setAiTodos((p) => [...p, { id: `manual-${Date.now()}`, text, done: false }]);
    setNewTodoText("");
  };

  const handleToggleGoal = (id: number) => {
    storageToggleGoal(id);
    setUserGoals(getGoals());
  };

  const clearEntry = () => {
    if (!window.confirm("Clear this entry? This cannot be undone.")) return;
    setEntryText(""); setAnalyzed(false); setMood(null); setAiTodos([]);
    setHabitDoneToday(new Set()); setAiHabitIds(new Set()); setDraftSaved(false);
    localStorage.removeItem(draftKey(currentDate));
    localStorage.removeItem(analysisKey(currentDate));
    localStorage.removeItem(`deskbuddy_draft_ts_${currentDate}`);
    // Overwrite server copy so it doesn't reappear on next load
    saveToAPI("(entry cleared)", null).catch(() => {});
  };

  const monthStr = (() => {
    const [y, m] = currentDate.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  })();

  // Mood badge for inline display
  const moodCfg = mood ? getMoodConfig(mood.emotion, mood.sentiment) : null;
  const musicMood = mood ? emotionToMusicMood(mood.emotion) : null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <DeskLayout>
      <div className="w-full pt-8 px-6 pb-20" style={{ maxWidth: "min(1400px, 95vw)", margin: "0 auto" }}>
        <BackButton />

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-pixel text-3xl uppercase tracking-widest text-pixel-black dark:text-[#F5E6D3]">
            Journal — {monthStr}
          </h2>
        </div>

        {/* Mobile panel tabs */}
        <div
          className="flex lg:hidden"
          style={{ borderLeft: "4px solid #292929", borderRight: "4px solid #292929", borderTop: "4px solid #292929" }}
        >
          {(["write", "sidebar"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPanelTab(tab)}
              className="flex-1 py-2 font-pixel text-sm uppercase tracking-wider transition-all"
              style={{
                background: panelTab === tab ? "#292929" : "#f9f9f9",
                color:      panelTab === tab ? "white" : "#666",
                borderRight: tab === "write" ? "2px dashed #ccc" : undefined,
              }}
            >
              {tab === "write" ? "✏ Write" : "☰ Habits & Memories"}
            </button>
          ))}
        </div>

        {/* Two-panel journal card */}
        <div
          className="grid lg:grid-cols-2 bg-white dark:bg-zinc-900 relative"
          style={{ border: "4px solid #292929", boxShadow: "4px 4px 0 0 rgba(0,0,0,0.10)", borderTop: "none", minHeight: "70vh" }}
        >
          {/* ── LEFT: Write panel ──────────────────────────────────────── */}
          <div
            className={`p-7 flex-col ${panelTab === "write" ? "flex" : "hidden lg:flex"}`}
            style={{ borderRight: "2px dashed #ccc", minHeight: "70vh" }}
          >
            {/* Date navigation row */}
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => goToDate(-1)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                  aria-label="Previous day"
                >
                  <span className="material-symbols-outlined text-xl text-pixel-black dark:text-[#F5E6D3]">chevron_left</span>
                </button>

                {/* Overlay an invisible date input on the date text — reliable cross-browser picker */}
                <div className="relative">
                  <span
                    className="font-pixel text-3xl text-pixel-black dark:text-[#F5E6D3] hover:opacity-60 transition-opacity cursor-pointer select-none"
                    title="Click to pick a date"
                  >
                    {displayDate(currentDate)}
                  </span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={currentDate}
                    onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
                    aria-label="Pick a date"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ colorScheme: "light" }}
                  />
                </div>

                <button
                  onClick={() => goToDate(1)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                  aria-label="Next day"
                >
                  <span className="material-symbols-outlined text-xl text-pixel-black dark:text-[#F5E6D3]">chevron_right</span>
                </button>
              </div>

              <button
                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
                title="Clear entry"
                onClick={clearEntry}
                aria-label="Clear entry"
              >
                <span className="material-symbols-outlined text-lg">ink_eraser</span>
              </button>
            </div>

            {loadingEntry ? (
              <div className="flex-1 flex items-center justify-center opacity-30">
                <span className="font-pixel text-xl animate-pulse">Loading…</span>
              </div>
            ) : (
              <>
                {/* Lined textarea */}
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={entryText}
                    onChange={(e) => setEntryText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canAnalyze) { e.preventDefault(); analyzeEntry(); }
                      if ((e.ctrlKey || e.metaKey) && e.key === "s")    { e.preventDefault(); if (entryText.trim()) saveEntry(); else { localStorage.removeItem(draftKey(currentDate)); showToast("✦ Entry cleared!"); } }
                    }}
                    placeholder="Dear Journal, today was..."
                    className="font-pixel w-full h-full bg-transparent border-none resize-none p-1 text-pixel-black dark:text-[#F5E6D3] placeholder-gray-300 focus:ring-0 focus:outline-none"
                    style={{
                      minHeight: "calc(70vh - 180px)",
                      fontSize: "21px",
                      lineHeight: "28px",
                      backgroundImage: "linear-gradient(#e8e8e8 1px, transparent 1px)",
                      backgroundSize: "100% 28px",
                      backgroundAttachment: "local",
                    }}
                  />
                  <span className="material-symbols-outlined absolute bottom-3 right-3 text-4xl opacity-10 pointer-events-none">pen_size_2</span>
                </div>

                <div className="flex justify-between items-center mt-2">
                  <p className="font-pixel text-sm text-gray-300">Ctrl/⌘+Enter to analyze · Ctrl/⌘+S to save</p>
                  <div className="flex items-center gap-3">
                    {draftSaved && (
                      <span className="font-pixel text-xs text-green-500 opacity-70">✓ draft saved</span>
                    )}
                    <p className="font-pixel text-lg text-gray-400">{wordCount} word{wordCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                <button
                  onClick={analyzeEntry}
                  disabled={!canAnalyze}
                  aria-busy={analyzing}
                  aria-label={analyzing ? "Analyzing your entry…" : "Analyze entry"}
                  className="mt-3 w-full py-3 font-pixel text-xl text-white flex items-center justify-center gap-2 transition-opacity"
                  style={{
                    background: "#292929", border: "3px solid #292929",
                    boxShadow: "4px 4px 0 rgba(0,0,0,0.1)",
                    opacity: canAnalyze ? 1 : 0.35,
                    cursor:  canAnalyze ? "pointer" : "not-allowed",
                  }}
                >
                  {analyzing ? (
                    <span className="flex gap-1">
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <span key={i} style={{ display: "inline-block", fontSize: 22, animation: `blink 1.2s ${delay}s infinite` }}>●</span>
                      ))}
                    </span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>psychology</span>
                      {analyzed ? "RE-ANALYZE" : "ANALYZE MY ENTRY"}
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* ── RIGHT: Habits + Memories + Todos ───────────────────────── */}
          <div className={`flex-col bg-gray-50 dark:bg-zinc-800 divide-y divide-dashed divide-gray-200 dark:divide-zinc-600 overflow-y-auto ${panelTab === "sidebar" ? "flex" : "hidden lg:flex"}`} style={{ maxHeight: "90vh" }}>

            {/* ── Top row: Habits + Memories ─────────────────────────── */}
            <div className="grid grid-cols-2 divide-x divide-dashed divide-gray-200 dark:divide-zinc-600">

              {/* Habits */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-pixel text-base uppercase tracking-wide text-pixel-black dark:text-[#F5E6D3]">Habits</h3>
                  <Link href="/tasks?add=habit&returnTo=/journal" className="font-pixel text-xs text-gray-400 hover:text-gray-700 dark:hover:text-[#F5E6D3] transition-colors">
                    + Add
                  </Link>
                </div>
                {userHabits.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 py-3 opacity-30 text-center">
                    <span className="material-symbols-outlined text-2xl">repeat</span>
                    <p className="font-pixel text-xs">No habits yet</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {userHabits.map((h) => (
                      <label key={h.id} className="flex items-center gap-2 cursor-pointer font-pixel text-sm text-pixel-black dark:text-[#F5E6D3]">
                        <input
                          type="checkbox"
                          checked={habitDoneToday.has(h.id)}
                          onChange={() => toggleHabitDone(h.id)}
                          className="w-4 h-4 border-2 border-gray-900 rounded-none focus:ring-0"
                          style={{ accentColor: "#292929" }}
                        />
                        <span className={habitDoneToday.has(h.id) ? "line-through opacity-50" : ""}>{h.name}</span>
                        {aiHabitIds.has(h.id) && <span className="text-orange-400 text-xs" title="AI suggested">✦</span>}
                      </label>
                    ))}
                  </div>
                )}

                {/* Goals below habits */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-pixel text-base uppercase tracking-wide text-pixel-black dark:text-[#F5E6D3]">Goals</h3>
                    <Link href="/tasks?add=goal&returnTo=/journal" className="font-pixel text-xs text-gray-400 hover:text-gray-700 dark:hover:text-[#F5E6D3] transition-colors">
                      + Add
                    </Link>
                  </div>
                  {userGoals.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 py-3 opacity-30 text-center">
                      <span className="material-symbols-outlined text-2xl">flag</span>
                      <p className="font-pixel text-xs">No goals yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {userGoals.slice(0, 3).map((g) => {
                        const isOverdue = !g.done && g.dueAt < currentDate;
                        return (
                          <label key={g.id} className="flex items-start gap-1.5 cursor-pointer font-pixel text-pixel-black dark:text-[#F5E6D3]">
                            <input
                              type="checkbox"
                              checked={g.done}
                              onChange={() => handleToggleGoal(g.id)}
                              className="w-4 h-4 mt-0.5 border-2 border-gray-900 rounded-none focus:ring-0 flex-shrink-0"
                              style={{ accentColor: "#292929" }}
                            />
                            <div className="min-w-0">
                              <span className={`text-xs ${g.done ? "line-through opacity-50" : ""}`}>{g.title}</span>
                              {isOverdue && <span className="block text-xs text-red-400">overdue</span>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Memories */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-pixel text-base uppercase tracking-wide text-pixel-black dark:text-[#F5E6D3]">Memories</h3>
                </div>
                <MemoriesGrid date={currentDate} />
              </div>
            </div>

            {/* ── Bottom: Mood chip + To-Do List ─────────────────────── */}
            <div className="p-5 flex-1">
              {/* Mood chip — only when analyzed */}
              {analyzed && mood && moodCfg && (
                <div
                  className="flex items-center gap-2 mb-4 px-3 py-2"
                  style={{ background: moodCfg.bg, border: `2px solid ${moodCfg.color}` }}
                >
                  <span style={{ fontSize: 22 }}>{moodCfg.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-pixel text-sm" style={{ color: moodCfg.color }}>
                      {mood.sentiment.toUpperCase()} · {mood.emotion}
                    </span>
                    {mood.mood_summary && (
                      <p className="font-pixel text-xs text-gray-500 truncate">{mood.mood_summary}</p>
                    )}
                  </div>
                  {musicMood && (
                    <Link
                      href={`/music?mood=${musicMood}`}
                      className="flex-shrink-0 flex items-center gap-1 font-pixel text-xs px-2 py-1 text-white transition-opacity hover:opacity-80"
                      style={{ background: "#1DB954", border: "1px solid #17a34a" }}
                    >
                      <span className="material-symbols-outlined text-sm">music_note</span>
                      Music
                    </Link>
                  )}
                </div>
              )}

              {/* To-Do List */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-pixel text-base uppercase tracking-wide text-pixel-black dark:text-[#F5E6D3]">
                  To-Do List
                </h3>
                {analyzed && aiTodos.some((t) => t.aiSuggested) && (
                  <span className="font-pixel text-xs text-orange-400 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>AI picks
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 mb-3">
                {aiTodos.length === 0 ? (
                  <p className="font-pixel text-sm opacity-30">
                    {analyzed ? "No tasks suggested." : "Analyze entry to get task suggestions ✦"}
                  </p>
                ) : (
                  aiTodos.map((t) => (
                    <label
                      key={t.id}
                      className={`flex items-center gap-2 p-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 font-pixel text-sm ${t.done ? "line-through text-gray-400" : "text-pixel-black dark:text-[#F5E6D3]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => toggleAiTodo(t.id)}
                        className="w-4 h-4 border-2 border-gray-900 rounded-none focus:ring-0 flex-shrink-0"
                        style={{ accentColor: "#292929" }}
                      />
                      <span>{t.text}</span>
                      {t.aiSuggested && <span className="text-orange-400 text-xs ml-auto flex-shrink-0">✦</span>}
                    </label>
                  ))
                )}
              </div>

              {/* Add new task input */}
              <div
                className="flex items-center gap-2 mt-2"
                style={{ borderTop: "1px dashed #ccc", paddingTop: "8px" }}
              >
                <input
                  type="text"
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addManualTodo()}
                  placeholder="+ Add new task"
                  className="flex-1 bg-transparent border-none font-pixel text-sm text-pixel-black dark:text-[#F5E6D3] placeholder-gray-300 focus:outline-none focus:ring-0"
                />
                {newTodoText.trim() && (
                  <button
                    onClick={addManualTodo}
                    className="font-pixel text-xs px-2 py-1 text-white"
                    style={{ background: "#292929" }}
                  >
                    ADD
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Save / Back buttons */}
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={saveEntry}
            disabled={saving}
            className="px-7 py-2 font-pixel text-xl text-white transition-opacity hover:opacity-80"
            style={{ background: "#292929", border: "3px solid #292929", boxShadow: "4px 4px 0 rgba(0,0,0,0.1)", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "SAVING…" : "SAVE ENTRY"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-7 py-2 font-pixel text-xl transition-opacity hover:opacity-80"
            style={{ background: "white", border: "3px solid #292929", boxShadow: "4px 4px 0 rgba(0,0,0,0.1)" }}
          >
            BACK TO DESK
          </button>
        </div>
      </div>

      <Toast message={toast} visible={toastVisible} />

      {/* Animation keyframes (fadeIn, blink) are defined in globals.css */}
    </DeskLayout>
  );
}
