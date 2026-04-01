/**
 * Single source of truth for all emotion/mood data across DeskBuddy.
 *
 * Centralising here means journal analysis, music recommendations, and display
 * all use the same emotion strings, colours, and task lists — update once,
 * reflected everywhere.
 */

// ── Emotion & Sentiment types ───────────────────────────────────────────────

export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

/** Full set of detectable emotions (used by keyword analysis + AI prompt). */
export const EMOTIONS = [
  "anxious", "excited", "happy", "sad", "calm",
  "grateful", "overwhelmed", "angry", "hopeful", "neutral",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** Emotions that belong to the positive/negative sentiment buckets. */
export const POSITIVE_EMOTIONS = new Set<string>(["happy", "excited", "grateful", "hopeful", "calm"]);
export const NEGATIVE_EMOTIONS = new Set<string>(["sad", "anxious", "angry", "overwhelmed"]);

// ── Mood display config ─────────────────────────────────────────────────────

export interface MoodConfig {
  emoji: string;
  /** CSS colour token used for text and border. */
  color: string;
  /** Light CSS background for the mood card. */
  bg: string;
}

/**
 * Maps every emotion (and the 3 sentiment labels) to display properties.
 * Sentiment keys act as a fallback when a specific emotion has no entry.
 */
export const MOOD_CONFIG: Record<string, MoodConfig> = {
  // sentiment-level fallbacks
  positive:    { emoji: "😊", color: "#4a7c59", bg: "#f0f7f2" },
  neutral:     { emoji: "😌", color: "#b8960c", bg: "#fdf9ec" },
  negative:    { emoji: "😔", color: "#c0392b", bg: "#fdf0ef" },
  // emotion-level entries
  anxious:     { emoji: "😰", color: "#2c5f8a", bg: "#eef4fb" },
  excited:     { emoji: "🤩", color: "#c96a2b", bg: "#fdf4ee" },
  sad:         { emoji: "😢", color: "#6b4f9e", bg: "#f5f2fb" },
  calm:        { emoji: "🧘", color: "#4a7c59", bg: "#f0f7f2" },
  angry:       { emoji: "😤", color: "#c0392b", bg: "#fdf0ef" },
  happy:       { emoji: "😄", color: "#4a7c59", bg: "#f0f7f2" },
  hopeful:     { emoji: "🌟", color: "#2c5f8a", bg: "#eef4fb" },
  overwhelmed: { emoji: "😵", color: "#6b4f9e", bg: "#f5f2fb" },
  grateful:    { emoji: "🙏", color: "#4a7c59", bg: "#f0f7f2" },
};

/**
 * Returns display config for a given emotion or sentiment string.
 * Falls back to a neutral grey entry if neither is recognised.
 */
export function getMoodConfig(emotion?: string, sentiment?: string): MoodConfig {
  return (
    MOOD_CONFIG[(emotion   ?? "").toLowerCase()] ??
    MOOD_CONFIG[(sentiment ?? "").toLowerCase()] ??
    { emoji: "😶", color: "#292929", bg: "#f7f7f7" }
  );
}

// ── Emotion → music mood mapping ────────────────────────────────────────────

/** The set of moods the music page accepts via ?mood= URL param. */
export const MUSIC_MOODS = ["anxious", "calm", "happy", "sad", "energetic", "focused"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

/**
 * Translates a detected journal emotion into the closest music mood.
 * Used when navigating from journal → music page so the playlist
 * auto-selects the most emotionally appropriate genre.
 */
export const EMOTION_TO_MUSIC_MOOD: Record<string, MusicMood> = {
  anxious:     "anxious",
  excited:     "energetic",
  happy:       "happy",
  sad:         "sad",
  calm:        "calm",
  grateful:    "happy",
  overwhelmed: "calm",
  angry:       "energetic",
  hopeful:     "happy",
  neutral:     "focused",
  // sentiment-level fallbacks for when only sentiment is available
  positive:    "happy",
  negative:    "sad",
};

/** Returns the best music mood for a detected emotion (defaults to "calm"). */
export function emotionToMusicMood(emotion: string): MusicMood {
  return EMOTION_TO_MUSIC_MOOD[emotion.toLowerCase()] ?? "calm";
}

// ── Habit & task data ───────────────────────────────────────────────────────

/** Default habits shown in the journal insights panel. */
export const DEFAULT_HABITS = ["Morning Water", "Read 10 mins", "Meditation", "No Sugar"] as const;

/**
 * Keyword patterns used by the fallback analysis to detect emotions.
 * Checked against lowercased journal text; most keyword hits wins.
 */
export const EMOTION_KEYWORDS: Record<string, string[]> = {
  anxious:     ["anxious", "nervous", "worried", "stress", "anxiety", "panic", "scared", "fear", "dread", "uneasy"],
  excited:     ["excited", "thrilled", "can't wait", "amazing", "pumped", "stoked", "win", "winning", "finally", "awesome", "fantastic"],
  happy:       ["happy", "great", "wonderful", "joy", "glad", "cheerful", "love", "good day", "nice day", "nice", "satisfying", "lovely", "pleasant", "enjoyed", "enjoyable", "fun", "delightful", "no complaints", "no regrets", "felt right", "feels right", "good stuff", "felt good", "feels good", "really good", "really nice", "complete", "perfect"],
  sad:         ["sad", "cry", "upset", "down", "lonely", "miss", "lost", "grief", "hurt", "depressed", "miserable", "heartbroken", "tearful"],
  calm:        ["calm", "peaceful", "relax", "serene", "quiet", "chill", "content", "easy", "settled", "simple", "gentle", "slow day", "low key", "laid back"],
  grateful:    ["grateful", "thankful", "appreciate", "blessed", "fortunate", "lucky", "grateful for", "thankful for", "so glad", "such a win"],
  overwhelmed: ["overwhelmed", "too much", "exhausted", "tired", "burnout", "can't handle", "so much", "falling behind", "swamped"],
  angry:       ["angry", "furious", "irritated", "rage", "outraged", "infuriated", "so angry", "so mad", "pissed"],
  hopeful:     ["hopeful", "optimistic", "looking forward", "hopeful", "improve", "hope", "can't wait", "excited for", "things will"],
};

/**
 * Short, actionable task suggestions per detected emotion.
 * Surfaced in the journal insights panel after analysis.
 */
export const EMOTION_TASKS: Record<string, string[]> = {
  anxious:     ["Take 5 deep breaths", "Step outside for 10 mins", "Write 3 things going well"],
  sad:         ["Reach out to a friend", "Do something gentle you enjoy", "Journal 3 small wins"],
  overwhelmed: ["Break one task into tiny steps", "Take a 15 min break now", "Say no to one thing today"],
  angry:       ["Take a walk before responding", "Write it out then delete it", "Do 10 jumping jacks"],
  happy:       ["Channel energy into a creative task", "Share the mood with someone", "Plan something fun"],
  excited:     ["Write down your next 3 goals", "Start that thing you've been delaying", "Celebrate the win"],
  calm:        ["Use this focus window wisely", "Tackle your hardest task now", "Do a mindful stretch"],
  grateful:    ["Write what you're thankful for", "Tell someone you appreciate them", "Plan something kind"],
  hopeful:     ["Set one concrete next step", "Visualise success for 5 mins", "Share your hope with someone"],
  neutral:     ["Check in with how you're feeling", "Set one intention for today", "Take a short walk"],
};
