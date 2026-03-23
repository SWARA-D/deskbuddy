/**
 * localStorage helpers for user-defined habits and goals.
 * Works in both SSR (returns empty) and client environments.
 */

export interface Habit {
  id: number;
  name: string;
  category: string;
  createdAt: string;
}

export interface Goal {
  id: number;
  title: string;
  category: string;
  dueAt: string;
  done: boolean;
  createdAt: string;
}

const HABITS_KEY = "deskbuddy_habits";
const GOALS_KEY  = "deskbuddy_goals";

// Guarantees unique numeric IDs even when called multiple times per millisecond.
let _counter = 0;
function nextId(): number { return Date.now() + (++_counter); }

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

// ── Habits ───────────────────────────────────────────────────────────────────

export function getHabits(): Habit[] {
  return readJSON<Habit[]>(HABITS_KEY, []);
}

export function addHabit(name: string, category: string): Habit {
  const habit: Habit = {
    id: nextId(),
    name,
    category,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(HABITS_KEY, JSON.stringify([...getHabits(), habit]));
  return habit;
}

export function removeHabit(id: number): void {
  localStorage.setItem(HABITS_KEY, JSON.stringify(getHabits().filter((h) => h.id !== id)));
}

// ── Goals ────────────────────────────────────────────────────────────────────

export function getGoals(): Goal[] {
  return readJSON<Goal[]>(GOALS_KEY, []);
}

export function addGoal(title: string, category: string, dueAt: string): Goal {
  const goal: Goal = {
    id: nextId(),
    title,
    category,
    dueAt,
    done: false,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(GOALS_KEY, JSON.stringify([...getGoals(), goal]));
  return goal;
}

export function toggleGoal(id: number): void {
  localStorage.setItem(
    GOALS_KEY,
    JSON.stringify(getGoals().map((g) => (g.id === id ? { ...g, done: !g.done } : g)))
  );
}

export function removeGoal(id: number): void {
  localStorage.setItem(GOALS_KEY, JSON.stringify(getGoals().filter((g) => g.id !== id)));
}
