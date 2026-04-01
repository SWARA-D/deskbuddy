/**
 * Central registry of all localStorage keys used by DeskBuddy.
 *
 * Import from here instead of scattering string literals across components.
 * This prevents typos and makes key renames a one-line change.
 */

// ── Desk layout ────────────────────────────────────────────────────────────
export const KEY_DESK_POSITIONS = "deskbuddy_desk_positions_v5";

// ── Journal ────────────────────────────────────────────────────────────────
/** Per-date draft text. Param: YYYY-MM-DD */
export const journalDraftKey  = (date: string) => `deskbuddy_draft_${date}`;
/** Per-date draft timestamp. Param: YYYY-MM-DD */
export const journalDraftTsKey = (date: string) => `deskbuddy_draft_ts_${date}`;
/** Per-date AI analysis result. Param: YYYY-MM-DD */
export const journalAnalysisKey = (date: string) => `deskbuddy_analysis_${date}`;
/** Per-date habit completion flags. Param: YYYY-MM-DD */
export const habitDoneKey = (date: string) => `deskbuddy_habit_done_${date}`;

// ── Snapshots / check-in ───────────────────────────────────────────────────
export const KEY_SNAPSHOTS = "deskbuddy_snapshots";
export const KEY_PINNED    = "deskbuddy_pinned";

// ── Tasks ──────────────────────────────────────────────────────────────────
export const KEY_TASKS = "deskbuddy_tasks";

// ── Bot ────────────────────────────────────────────────────────────────────
export const KEY_BOT_HISTORY = "deskbuddy_bot_history";

// ── Stale keys from previous versions (safe to remove on boot) ─────────────
export const STALE_DESK_KEYS = [
  "deskbuddy_desk_positions_v1",
  "deskbuddy_desk_positions_v2",
  "deskbuddy_desk_positions_v3",
  "deskbuddy_desk_positions_v4",
];
