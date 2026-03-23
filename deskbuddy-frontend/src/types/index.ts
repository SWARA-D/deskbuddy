/**
 * Shared TypeScript types used across frontend pages and API routes.
 * Keeping types in one place prevents interface drift between the
 * journal page, analyze API, and journal entries API.
 */

// ── Analysis / mood ─────────────────────────────────────────────────────────

/** Result returned by POST /api/analyze */
export interface MoodResult {
  sentiment: "positive" | "neutral" | "negative";
  /** Single-word emotion label (see EMOTIONS in constants/moods.ts). */
  emotion: string;
  /** 0.0–1.0 confidence score. */
  confidence: number;
  /** One-sentence summary of the detected emotional state. */
  mood_summary: string;
  /** Habits the AI recommends highlighting for this mood. */
  habits_to_highlight: string[];
  /** Short actionable tasks tailored to the mood. */
  suggested_tasks: string[];
  /** Which analysis engine was used (for debug/UX messaging). */
  _source?: "claude" | "huggingface" | "keyword";
}

// ── Journal ─────────────────────────────────────────────────────────────────

/** A single journal entry as stored and returned by the API. */
export interface JournalEntry {
  id: string;
  user_id?: string;
  text: string;
  /** How the entry was created: "typed" | "voice" | etc. */
  input_type: string;
  created_at: string;
  sentiment?: string;
  emotion?: string;
  /** 0.0–1.0 confidence score from analysis. */
  confidence?: number;
  mood_summary?: string;
}

/** Paginated response from GET /api/journal/entries */
export interface EntriesResponse {
  entries: JournalEntry[];
  total: number;
  page: number;
  /** Total number of pages available. */
  pages: number;
  per_page: number;
}

// ── Music / Spotify ─────────────────────────────────────────────────────────

/** Minimal info needed to render a playlist option. */
export interface PlaylistInfo {
  id: string;
  name: string;
}

/** Result returned by GET /api/spotify/playlists */
export interface PlaylistResult {
  playlistId: string;
  playlistName: string;
  /** "curated" | "fallback" — where the playlist data came from. */
  source: string;
  mood: string;
  allPlaylists: PlaylistInfo[];
}
