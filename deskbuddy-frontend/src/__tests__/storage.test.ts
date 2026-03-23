// @vitest-environment jsdom
/**
 * Tests for src/lib/storage.ts — localStorage CRUD for Habits and Goals.
 *
 * Uses jsdom so localStorage is available without a real browser.
 * Each test group clears localStorage in beforeEach so tests are fully isolated.
 *
 * Covers:
 *  - Habits: getHabits, addHabit, removeHabit
 *  - Goals:  getGoals, addGoal, toggleGoal, removeGoal
 *  - Shape validation: returned objects have required fields
 *  - Isolation: habits and goals use separate storage keys
 *  - Robustness: corrupted localStorage data returns empty array (no throw)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getHabits, addHabit, removeHabit,
  getGoals, addGoal, toggleGoal, removeGoal,
} from "@/lib/storage";

beforeEach(() => {
  localStorage.clear();
});

// ── Habits ────────────────────────────────────────────────────────────────────

describe("getHabits", () => {
  it("returns an empty array when no habits have been saved", () => {
    expect(getHabits()).toEqual([]);
  });

  it("returns all added habits", () => {
    addHabit("Morning run", "fitness");
    addHabit("Read 20 pages", "learning");
    expect(getHabits()).toHaveLength(2);
  });

  it("returns [] without throwing when localStorage contains invalid JSON", () => {
    localStorage.setItem("deskbuddy_habits", "NOT_JSON{{{");
    expect(() => getHabits()).not.toThrow();
    expect(getHabits()).toEqual([]);
  });
});

describe("addHabit", () => {
  it("returns a Habit object with correct fields", () => {
    const habit = addHabit("Meditate", "wellness");
    expect(habit.name).toBe("Meditate");
    expect(habit.category).toBe("wellness");
    expect(typeof habit.id).toBe("number");
    expect(typeof habit.createdAt).toBe("string");
    expect(habit.createdAt).toBeTruthy();
  });

  it("persists the habit so getHabits() includes it", () => {
    addHabit("Drink water", "health");
    const habits = getHabits();
    expect(habits.some((h) => h.name === "Drink water")).toBe(true);
  });

  it("accumulates multiple habits without overwriting", () => {
    addHabit("Habit A", "cat1");
    addHabit("Habit B", "cat2");
    addHabit("Habit C", "cat3");
    expect(getHabits()).toHaveLength(3);
  });

  it("assigns unique ids to each habit", () => {
    const h1 = addHabit("Wake early", "routine");
    const h2 = addHabit("Cold shower", "routine");
    expect(h1.id).not.toBe(h2.id);
  });

  it("stores habits with done: false implicitly (no done field on Habit)", () => {
    const habit = addHabit("Journal", "reflection");
    expect("done" in habit).toBe(false);
  });
});

describe("removeHabit", () => {
  it("removes a habit by id", () => {
    const habit = addHabit("Yoga", "fitness");
    removeHabit(habit.id);
    expect(getHabits().find((h) => h.id === habit.id)).toBeUndefined();
  });

  it("does not remove other habits when one is removed", () => {
    const h1 = addHabit("Habit A", "cat");
    const h2 = addHabit("Habit B", "cat");
    removeHabit(h1.id);
    const remaining = getHabits();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(h2.id);
  });

  it("does not throw when removing a non-existent id", () => {
    addHabit("Some habit", "cat");
    expect(() => removeHabit(999999)).not.toThrow();
    expect(getHabits()).toHaveLength(1);
  });

  it("results in empty array after removing the only habit", () => {
    const h = addHabit("Solo habit", "misc");
    removeHabit(h.id);
    expect(getHabits()).toEqual([]);
  });
});

// ── Goals ─────────────────────────────────────────────────────────────────────

describe("getGoals", () => {
  it("returns an empty array when no goals have been saved", () => {
    expect(getGoals()).toEqual([]);
  });

  it("returns all added goals", () => {
    addGoal("Run a 5K", "fitness", "2026-06-01");
    addGoal("Learn Spanish", "learning", "2026-12-31");
    expect(getGoals()).toHaveLength(2);
  });

  it("returns [] without throwing when localStorage contains invalid JSON", () => {
    localStorage.setItem("deskbuddy_goals", "CORRUPT{{");
    expect(() => getGoals()).not.toThrow();
    expect(getGoals()).toEqual([]);
  });
});

describe("addGoal", () => {
  it("returns a Goal object with correct fields", () => {
    const goal = addGoal("Read 12 books", "learning", "2026-12-31");
    expect(goal.title).toBe("Read 12 books");
    expect(goal.category).toBe("learning");
    expect(goal.dueAt).toBe("2026-12-31");
    expect(goal.done).toBe(false);
    expect(typeof goal.id).toBe("number");
    expect(typeof goal.createdAt).toBe("string");
  });

  it("new goals always start with done = false", () => {
    const goal = addGoal("Ship a product", "work", "2026-09-01");
    expect(goal.done).toBe(false);
  });

  it("persists goal so getGoals() includes it", () => {
    addGoal("Lose 5kg", "health", "2026-08-01");
    expect(getGoals().some((g) => g.title === "Lose 5kg")).toBe(true);
  });

  it("accumulates multiple goals without overwriting", () => {
    addGoal("Goal A", "cat", "2026-01-01");
    addGoal("Goal B", "cat", "2026-02-01");
    expect(getGoals()).toHaveLength(2);
  });

  it("assigns unique ids to each goal", () => {
    const g1 = addGoal("Goal One", "cat", "2026-01-01");
    const g2 = addGoal("Goal Two", "cat", "2026-02-01");
    expect(g1.id).not.toBe(g2.id);
  });
});

describe("toggleGoal", () => {
  it("marks a goal as done when it was not done", () => {
    const goal = addGoal("Exercise daily", "health", "2026-06-01");
    toggleGoal(goal.id);
    expect(getGoals().find((g) => g.id === goal.id)?.done).toBe(true);
  });

  it("marks a goal as not done when it was already done (toggles back)", () => {
    const goal = addGoal("Write every day", "creative", "2026-06-01");
    toggleGoal(goal.id);
    toggleGoal(goal.id);
    expect(getGoals().find((g) => g.id === goal.id)?.done).toBe(false);
  });

  it("only toggles the targeted goal, not others", () => {
    const g1 = addGoal("Goal one", "cat", "2026-01-01");
    const g2 = addGoal("Goal two", "cat", "2026-02-01");
    toggleGoal(g1.id);
    const goals = getGoals();
    expect(goals.find((g) => g.id === g1.id)?.done).toBe(true);
    expect(goals.find((g) => g.id === g2.id)?.done).toBe(false);
  });

  it("does not throw when toggling a non-existent id", () => {
    addGoal("Some goal", "cat", "2026-01-01");
    expect(() => toggleGoal(999999)).not.toThrow();
  });
});

describe("removeGoal", () => {
  it("removes a goal by id", () => {
    const goal = addGoal("Goal to delete", "misc", "2026-01-01");
    removeGoal(goal.id);
    expect(getGoals().find((g) => g.id === goal.id)).toBeUndefined();
  });

  it("does not remove other goals when one is removed", () => {
    const g1 = addGoal("Keep this one", "misc", "2026-01-01");
    const g2 = addGoal("Delete this one", "misc", "2026-02-01");
    removeGoal(g2.id);
    const remaining = getGoals();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(g1.id);
  });

  it("does not throw when removing a non-existent id", () => {
    addGoal("Some goal", "misc", "2026-01-01");
    expect(() => removeGoal(999999)).not.toThrow();
    expect(getGoals()).toHaveLength(1);
  });
});

// ── Isolation ─────────────────────────────────────────────────────────────────

describe("storage isolation", () => {
  it("habits and goals are stored independently (different keys)", () => {
    addHabit("Morning jog", "fitness");
    addGoal("Run a marathon", "fitness", "2026-10-01");

    // Both should exist independently.
    expect(getHabits()).toHaveLength(1);
    expect(getGoals()).toHaveLength(1);

    // Stored under different keys.
    const habitRaw = localStorage.getItem("deskbuddy_habits");
    const goalRaw  = localStorage.getItem("deskbuddy_goals");
    expect(habitRaw).not.toBe(goalRaw);
    expect(habitRaw).toContain("Morning jog");
    expect(goalRaw).toContain("Run a marathon");
  });

  it("removing all habits does not affect goals", () => {
    const h = addHabit("Yoga", "wellness");
    addGoal("Meditate 30 days", "wellness", "2026-06-01");
    removeHabit(h.id);
    expect(getHabits()).toHaveLength(0);
    expect(getGoals()).toHaveLength(1);
  });

  it("removing all goals does not affect habits", () => {
    addHabit("Sleep by 10pm", "health");
    const g = addGoal("Sleep goal", "health", "2026-06-01");
    removeGoal(g.id);
    expect(getGoals()).toHaveLength(0);
    expect(getHabits()).toHaveLength(1);
  });
});
