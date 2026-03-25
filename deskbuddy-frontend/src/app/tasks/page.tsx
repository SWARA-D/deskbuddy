"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DeskLayout from "@/components/layout/DeskLayout";
import BackButton from "@/components/ui/BackButton";
import {
  addHabit, addGoal, getHabits, getGoals,
  removeHabit, removeGoal, toggleGoal,
} from "@/lib/storage";
import type { Habit, Goal } from "@/lib/storage";

interface Task {
  id: number;
  title: string;
  category: string;
  difficulty: 1 | 2 | 3;
  dueAt: string;
  status: "todo" | "done";
}

const CATEGORIES = ["confidence", "social", "health", "work", "learning"] as const;
type Category = (typeof CATEGORIES)[number];
type ItemType = "task" | "habit" | "goal";

// ── TaskSection sub-component ────────────────────────────────────────────────

function TaskSection({
  section,
  list,
  onToggleDone,
}: {
  section: string;
  list: Task[];
  onToggleDone: (id: number) => void;
}) {
  return (
    <>
      <p className="font-pixel text-xs opacity-40 uppercase tracking-widest mb-2">{section}</p>
      {list.length === 0 ? (
        <p className="font-pixel text-xs opacity-25 mb-4">
          {section.toLowerCase() === "upcoming" ? "Nothing scheduled" : "Nothing here yet"}
        </p>
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {list.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 bg-white/40 dark:bg-black/20 border border-black/10 rounded-lg p-3 pixel-shadow"
            >
              <button
                onClick={() => onToggleDone(t.id)}
                type="button"
                aria-label={t.status === "done" ? "Mark incomplete" : "Mark complete"}
                className="flex-shrink-0"
              >
                <span className="material-symbols-outlined text-lg text-primary">
                  {t.status === "done" ? "check_circle" : "radio_button_unchecked"}
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-display text-sm ${t.status === "done" ? "line-through opacity-50" : ""}`}>
                  {t.title}
                </p>
                <p className="font-pixel text-xs opacity-30">
                  {t.category} · difficulty {t.difficulty} · due {t.dueAt}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Page inner (needs Suspense for useSearchParams) ───────────────────────────

function TasksInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const addParam = searchParams.get("add");
  const returnTo = searchParams.get("returnTo");

  const [itemType,   setItemType]   = useState<ItemType>(
    addParam === "habit" ? "habit" : addParam === "goal" ? "goal" : "task"
  );
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [habits,     setHabits]     = useState<Habit[]>([]);
  const [goals,      setGoals]      = useState<Goal[]>([]);
  const [title,      setTitle]      = useState("");
  const [category,   setCategory]   = useState<Category | "">("");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);
  const [dueAt,      setDueAt]      = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const TASKS_KEY = "deskbuddy_tasks";

  useEffect(() => {
    setHabits(getHabits());
    setGoals(getGoals());
    try {
      const saved = localStorage.getItem(TASKS_KEY);
      if (saved) setTasks(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const saveTasks = (next: Task[]) => {
    setTasks(next);
    try { localStorage.setItem(TASKS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const todayTasks    = tasks.filter((t) => t.dueAt === today);
  const upcomingTasks = tasks.filter((t) => t.dueAt >  today);

  const handleAdd = () => {
    if (!title.trim() || !category) return;

    if (itemType === "habit") {
      addHabit(title.trim(), category as Category);
      setHabits(getHabits());
      setTitle("");
      setCategory("");
      if (returnTo) router.push(returnTo);
    } else if (itemType === "goal") {
      if (!dueAt) return;
      addGoal(title.trim(), category as Category, dueAt);
      setGoals(getGoals());
      setTitle("");
      setCategory("");
      if (returnTo) router.push(returnTo);
    } else {
      if (!dueAt) return;
      saveTasks([
        ...tasks,
        { id: Date.now(), title: title.trim(), category: category as Category, difficulty, dueAt, status: "todo" },
      ]);
      setTitle("");
      setCategory("");
    }
  };

  const toggleDone = (id: number) =>
    saveTasks(tasks.map((t) => t.id === id ? { ...t, status: t.status === "todo" ? "done" : "todo" } : t));

  return (
    <DeskLayout>
      <div className="max-w-2xl mx-auto pt-10 pb-20 px-4">
        <BackButton />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-pixel text-3xl uppercase tracking-widest text-pixel-black dark:text-[#F5E6D3]">
            {itemType === "habit" ? "Add Habit" : itemType === "goal" ? "Add Goal" : "Tasks"}
          </h2>
          {returnTo && (
            <button
              onClick={() => router.push(returnTo)}
              className="flex items-center gap-1 font-pixel text-sm opacity-50 hover:opacity-100 transition-opacity dark:text-[#F5E6D3]"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to {returnTo === "/journal" ? "Journal" : "previous page"}
            </button>
          )}
        </div>

        {/* Type selector tabs */}
        <div className="flex gap-2 mb-6">
          {(["task", "habit", "goal"] as ItemType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setItemType(type)}
              className={`px-4 py-1.5 font-pixel text-sm uppercase tracking-wider border-2 transition-all
                ${itemType === type
                  ? "bg-pixel-black text-white border-pixel-black dark:bg-[#F5E6D3] dark:text-pixel-black dark:border-[#F5E6D3]"
                  : "bg-transparent border-black/20 hover:border-black/50 dark:text-[#F5E6D3] dark:border-white/20 dark:hover:border-white/50"
                }`}
            >
              {type === "task" ? "📋 Task" : type === "habit" ? "🔁 Habit" : "🎯 Goal"}
            </button>
          ))}
        </div>

        {/* Add form */}
        <div className="bg-white/60 dark:bg-black/30 backdrop-blur-sm border-2 border-black/10 rounded-xl p-5 pixel-shadow mb-8">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={
              itemType === "habit" ? "e.g. Morning Water, Read 10 mins, Meditate…"
                : itemType === "goal" ? "e.g. Run a 5K, Learn Spanish, Save $500…"
                : "New micro-task…"
            }
            className="w-full bg-transparent border-none outline-none font-display text-base placeholder:opacity-40 dark:text-[#F5E6D3] mb-3"
          />

          <div className="flex flex-wrap gap-3 items-end">
            {/* Category — required */}
            <div className="flex flex-col gap-1">
              <label className="font-pixel text-xs opacity-40 uppercase">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                required
                className={`bg-white/40 dark:bg-black/20 border rounded-lg px-3 py-1.5 font-pixel text-sm outline-none dark:text-[#F5E6D3] ${
                  category === "" ? "border-red-300 text-gray-400" : "border-black/10"
                }`}
              >
                <option value="" disabled>Select category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Difficulty — tasks only */}
            {itemType === "task" && (
              <div className="flex flex-col gap-1">
                <label className="font-pixel text-xs opacity-40 uppercase">Difficulty</label>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      aria-pressed={difficulty === d}
                      className={`w-8 h-8 rounded-lg border-2 font-pixel text-sm transition-colors
                        ${difficulty === d
                          ? "bg-primary/30 border-primary/50 text-primary"
                          : "border-black/10 bg-white/30 dark:bg-black/20"
                        }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Due / target date — tasks and goals */}
            {itemType !== "habit" && (
              <div className="flex flex-col gap-1">
                <label className="font-pixel text-xs opacity-40 uppercase">
                  {itemType === "goal" ? "Target Date" : "Due"}
                </label>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="bg-white/40 dark:bg-black/20 border border-black/10 rounded-lg px-3 py-1.5 font-pixel text-sm outline-none dark:text-[#F5E6D3]"
                />
              </div>
            )}

            <button
              onClick={handleAdd}
              type="button"
              disabled={!title.trim() || !category}
              className="px-5 py-1.5 bg-primary/30 hover:bg-primary/50 border border-primary/40 rounded-lg font-pixel text-sm uppercase tracking-widest transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Add {itemType}
            </button>
          </div>
        </div>

        {/* Task lists */}
        {itemType === "task" && (
          <>
            <TaskSection section="Today"    list={todayTasks}    onToggleDone={toggleDone} />
            <TaskSection section="Upcoming" list={upcomingTasks} onToggleDone={toggleDone} />
          </>
        )}

        {/* ── My Habits list — only on habit tab ─────────────────────────── */}
        {itemType === "habit" && (
          <div className="mb-8">
            <p className="font-pixel text-xs opacity-40 uppercase tracking-widest mb-3">
              My Habits {habits.length > 0 && `(${habits.length})`}
            </p>
            {habits.length === 0 ? (
              <p className="font-pixel text-xs opacity-25">No habits yet — add your first one above!</p>
            ) : (
              <div className="flex flex-col gap-2">
                {habits.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 bg-white/40 dark:bg-black/20 border border-black/10 rounded-lg p-3 pixel-shadow"
                  >
                    <span className="text-base flex-shrink-0">🔁</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm">{h.name}</p>
                      <p className="font-pixel text-xs opacity-30">{h.category} · repeats daily</p>
                    </div>
                    <button
                      onClick={() => { removeHabit(h.id); setHabits(getHabits()); }}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      aria-label="Remove habit"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── My Goals list — only on goal tab ───────────────────────────── */}
        {itemType === "goal" && (
          <div className="mb-8">
            <p className="font-pixel text-xs opacity-40 uppercase tracking-widest mb-3">
              My Goals {goals.length > 0 && `(${goals.length})`}
            </p>
            {goals.length === 0 ? (
              <p className="font-pixel text-xs opacity-25">No goals yet — set your first one above!</p>
            ) : (
              <div className="flex flex-col gap-2">
                {goals.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 bg-white/40 dark:bg-black/20 border border-black/10 rounded-lg p-3 pixel-shadow"
                  >
                    <button
                      onClick={() => { toggleGoal(g.id); setGoals(getGoals()); }}
                      type="button"
                      aria-label={g.done ? "Mark incomplete" : "Mark complete"}
                      className="flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-lg text-primary">
                        {g.done ? "check_circle" : "radio_button_unchecked"}
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-display text-sm ${g.done ? "line-through opacity-50" : ""}`}>
                        {g.title}
                      </p>
                      <p className="font-pixel text-xs opacity-30">{g.category} · target {g.dueAt}</p>
                    </div>
                    <button
                      onClick={() => { removeGoal(g.id); setGoals(getGoals()); }}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      aria-label="Remove goal"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DeskLayout>
  );
}

// ── Suspense wrapper (required for useSearchParams in Next.js app router) ─────

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <span className="font-pixel text-xl opacity-30 animate-pulse">Loading…</span>
      </div>
    }>
      <TasksInner />
    </Suspense>
  );
}
