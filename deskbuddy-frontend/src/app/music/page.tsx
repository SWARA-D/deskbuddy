"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DeskLayout from "@/components/layout/DeskLayout";
import BackButton from "@/components/ui/BackButton";
import { getPlaylistForMood, type PlaylistInfo } from "@/utils/spotify";
import { MUSIC_MOODS, type MusicMood } from "@/constants/moods";

// ── Mood display metadata (music-page-specific) ─────────────────────────────

const MOOD_DISPLAY: Record<MusicMood, string> = {
  anxious:  "ANXIETY RELIEF",
  calm:     "CALM FOCUS",
  happy:    "HAPPY VIBES",
  sad:      "RAINY DAY",
  energetic:"ENERGETIC",
  focused:  "DEEP FOCUS",
};

const MOOD_EMOJIS: Record<MusicMood, string> = {
  anxious:  "😌",
  calm:     "🌿",
  happy:    "😊",
  sad:      "🌧️",
  energetic:"⚡",
  focused:  "🎯",
};

/** Tailwind gradient classes for the fullscreen playlist overlay per mood. */
const MOOD_GRADIENTS: Record<MusicMood, string> = {
  anxious:  "from-indigo-900/90 via-purple-900/90 to-slate-900/90",
  calm:     "from-teal-900/90 via-emerald-900/90 to-slate-900/90",
  happy:    "from-yellow-700/90 via-orange-800/90 to-red-900/90",
  sad:      "from-slate-800/90 via-blue-900/90 to-gray-900/90",
  energetic:"from-red-800/90 via-pink-900/90 to-purple-900/90",
  focused:  "from-gray-800/90 via-slate-900/90 to-zinc-900/90",
};

// ── SignalBars sub-component ────────────────────────────────────────────────

/** Animated signal bars shown in the iPod screen header when music is playing. */
function SignalBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-3">
      {[2, 1, 3, 2].map((h, i) => (
        <div
          key={i}
          style={{ height: `${h * 3}px`, animationDelay: `${i * 0.12}s` }}
          className={`w-[2px] rounded-sm bg-[#2d3d24] ${active ? "animate-pulse" : "opacity-30"}`}
        />
      ))}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function MusicInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  // ── Journal bridge state ───────────────────────────────────────────────
  const [journalNote,    setJournalNote]    = useState("");
  const [journalPrompt,  setJournalPrompt]  = useState(false);

  const appendToJournal = () => {
    const note = journalNote.trim();
    if (!note) { router.push("/journal"); return; }
    const today    = new Date().toISOString().slice(0, 10);
    const draftKey = `deskbuddy_draft_${today}`;
    const existing = localStorage.getItem(draftKey) ?? "";
    const moodLabel = mood ? ` [listening to ${MOOD_DISPLAY[mood]}]` : "";
    const appended  = existing
      ? `${existing}\n\n---${moodLabel}\n${note}`
      : `${moodLabel ? moodLabel.trim() + "\n" : ""}${note}`;
    localStorage.setItem(draftKey, appended);
    router.push("/journal");
  };

  // ── Playback state ─────────────────────────────────────────────────────
  const [mood,         setMood]         = useState<MusicMood | null>(null);
  const [playlistId,   setPlaylistId]   = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState<string>("");
  const [allPlaylists, setAllPlaylists] = useState<PlaylistInfo[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [animating,    setAnimating]    = useState<"zoom-in" | "zoom-out" | null>(null);
  const [playlistError, setPlaylistError] = useState(false);

  // Stores the pixel coordinates of the iPod screen centre so the zoom
  // animation expands from the right origin point.
  const screenRef   = useRef<HTMLDivElement>(null);
  const [zoomOrigin, setZoomOrigin] = useState({ x: "50%", y: "50%" });

  // ── Auto-select mood from URL param ────────────────────────────────────

  /**
   * When arriving from the journal page (/music?mood=anxious), auto-load the
   * playlist so the user lands directly in the music experience.
   * `autoSelectedRef` prevents the effect from re-triggering on every render.
   */
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    const moodParam = searchParams.get("mood") as MusicMood | null;
    if (moodParam && MUSIC_MOODS.includes(moodParam)) {
      autoSelectedRef.current = true;
      selectMood(moodParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Zoom helpers ───────────────────────────────────────────────────────

  /** Captures the iPod screen centre for use as the CSS zoom transform origin. */
  function calcZoomOrigin() {
    if (screenRef.current) {
      const rect = screenRef.current.getBoundingClientRect();
      setZoomOrigin({
        x: `${rect.left + rect.width  / 2}px`,
        y: `${rect.top  + rect.height / 2}px`,
      });
    }
  }

  // ── Mood & playlist actions ────────────────────────────────────────────

  /** Load playlists for the chosen mood and zoom into fullscreen view. */
  async function selectMood(m: MusicMood) {
    setMood(m);
    setLoading(true);
    setPlaylistError(false);

    calcZoomOrigin();
    setAnimating("zoom-in");
    setTimeout(() => { setIsFullscreen(true); setAnimating(null); }, 400);

    try {
      const result = await getPlaylistForMood(m);
      setPlaylistId(result.playlistId);
      setPlaylistName(result.playlistName);
      setAllPlaylists(result.allPlaylists || []);
    } catch (err) {
      console.error("Failed to load playlist:", err);
      setPlaylistError(true);
    } finally {
      setLoading(false);
    }
  }

  /** Return to mood selector. */
  function backToMoods() {
    if (isFullscreen) {
      calcZoomOrigin();
      setAnimating("zoom-out");
      setTimeout(() => {
        setIsFullscreen(false);
        setPlaylistId(null);
        setAllPlaylists([]);
        setMood(null);
        setAnimating(null);
      }, 400);
    } else {
      setPlaylistId(null);
      setAllPlaylists([]);
      setMood(null);
    }
  }

  function exitToIpod() {
    calcZoomOrigin();
    setAnimating("zoom-out");
    setTimeout(() => { setIsFullscreen(false); setAnimating(null); }, 400);
  }

  function expandToFullscreen() {
    calcZoomOrigin();
    setAnimating("zoom-in");
    setTimeout(() => { setIsFullscreen(true); setAnimating(null); }, 400);
  }

  /** Switch to a specific playlist. */
  function switchPlaylist(id: string) {
    const playlist = allPlaylists.find((p) => p.id === id);
    if (!playlist) return;
    setPlaylistId(playlist.id);
    setPlaylistName(playlist.name);
  }

  function prevPlaylist() {
    if (!playlistId || allPlaylists.length < 2) return;
    const idx = allPlaylists.findIndex((p) => p.id === playlistId);
    switchPlaylist(allPlaylists[(idx - 1 + allPlaylists.length) % allPlaylists.length].id);
  }

  function nextPlaylist() {
    if (!playlistId || allPlaylists.length < 2) return;
    const idx = allPlaylists.findIndex((p) => p.id === playlistId);
    switchPlaylist(allPlaylists[(idx + 1) % allPlaylists.length].id);
  }

  // True when a playlist is loaded but the overlay is not fullscreen.
  const showPlaylistInIpod = mood !== null && !isFullscreen;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <DeskLayout>

      <div className="max-w-2xl mx-auto pt-10 px-4 pb-20">
        <BackButton />

        <h2 className="font-pixel text-3xl uppercase tracking-widest mb-6 text-pixel-black dark:text-[#F5E6D3]">
          iPod
        </h2>

        {/* ── iPod device shell ──────────────────────────────────────── */}
        <div className="flex justify-center mb-8">
          <div
            className="w-72 rounded-[2.5rem] p-5 pixel-shadow"
            style={{
              background: "linear-gradient(160deg,#e8e8e8 0%,#d0d0d0 50%,#c8c8c8 100%)",
              border:     "1px solid #b8b8b8",
              boxShadow:  "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
          >
            <p className="text-center text-xs tracking-[0.3em] text-[#888] font-pixel mb-2 uppercase">
              DeskBuddy
            </p>

            {/* iPod screen */}
            <div
              ref={screenRef}
              className="rounded-xl mb-5 overflow-hidden relative"
              style={{
                background: "linear-gradient(180deg,#a8c898 0%,#88aa78 100%)",
                border:     "3px solid #3a4e31",
                boxShadow:  "inset 0 2px 8px rgba(0,0,0,0.3)",
                height:     "240px",
              }}
            >
              {/* CRT scanline overlay */}
              <div
                className="absolute inset-0 pointer-events-none z-10 opacity-[0.06]"
                style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,#000 2px,#000 4px)" }}
              />

              <div className="relative z-20 h-full flex flex-col">
                {/* Screen header bar */}
                <div className="flex justify-between items-center px-3 pt-2.5 pb-2 border-b-2 border-[#2d3d24]/30 shrink-0">
                  <span className="font-pixel text-[#1a2a12] text-[10px] uppercase tracking-wide leading-none">
                    {showPlaylistInIpod ? MOOD_DISPLAY[mood] : "PICK A MOOD"}
                  </span>
                  <SignalBars active={showPlaylistInIpod} />
                </div>

                {/* Mood selector grid — shown when no playlist is loaded */}
                {!showPlaylistInIpod && (
                  <div className="flex-1 p-3 flex flex-col justify-center">
                    <div className="grid grid-cols-2 gap-2">
                      {MUSIC_MOODS.map((m) => (
                        <button
                          key={m}
                          onClick={() => selectMood(m)}
                          className="bg-[#2d3d24]/10 hover:bg-[#2d3d24]/20 border-2 border-[#2d3d24]/30 rounded-lg p-2.5 font-pixel text-[#1a2a12] text-[10px] uppercase tracking-wider transition-all active:scale-95 flex flex-col items-center gap-0.5"
                        >
                          <span className="text-base">{MOOD_EMOJIS[m]}</span>
                          <span>{m}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mini playlist info — shown in iPod view while music plays */}
                {showPlaylistInIpod && (
                  <div className="flex-1 flex flex-col">
                    {loading ? (
                      /* Loading skeleton — pulsing placeholders while playlist resolves */
                      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#2d3d24]/20 animate-pulse" />
                        <div className="w-28 h-2.5 rounded bg-[#2d3d24]/20 animate-pulse" />
                        <div className="w-16 h-2 rounded bg-[#2d3d24]/10 animate-pulse" />
                      </div>
                    ) : (
                    <div className="flex-1 flex flex-col items-center justify-center px-4 gap-2">
                      <span className="text-3xl">{MOOD_EMOJIS[mood]}</span>
                      <p className="font-pixel text-[#1a2a12] text-xs uppercase tracking-widest text-center leading-tight">
                        {playlistName}
                      </p>
                      <p className="font-pixel text-[#1a2a12]/40 text-[10px] uppercase tracking-wider">
                        ♫ Now playing
                      </p>
                    </div>
                    )}

                    <div className="flex gap-1 px-2 pb-2 shrink-0">
                      <button
                        onClick={expandToFullscreen}
                        className="flex-1 bg-[#2d3d24]/20 border border-[#2d3d24]/30 rounded-md py-1.5 font-pixel text-[#1a2a12] text-xs uppercase tracking-wider hover:bg-[#2d3d24]/30 transition-all active:scale-95 flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>fullscreen</span>
                        Expand
                      </button>
                      <button
                        onClick={backToMoods}
                        className="flex-1 bg-[#2d3d24]/15 border border-[#2d3d24]/25 rounded-md py-1.5 font-pixel text-[#1a2a12] text-xs uppercase tracking-wider hover:bg-[#2d3d24]/25 transition-all active:scale-95 flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>arrow_back</span>
                        Moods
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Click wheel — four cardinal buttons + centre play/pause */}
            <div className="flex justify-center">
              <div
                className="relative w-36 h-36 rounded-full flex items-center justify-center select-none"
                style={{
                  background: "linear-gradient(145deg,#e0e0e0,#c8c8c8)",
                  boxShadow:  "inset 0 2px 10px rgba(0,0,0,0.07), 0 6px 16px rgba(0,0,0,0.13)",
                }}
              >
                {/* TOP — back to mood selector */}
                <button onClick={backToMoods} className="absolute top-2 font-bold text-gray-400 hover:text-gray-600 text-[10px] tracking-[0.15em] transition-colors active:scale-90" title="Back to mood selector">
                  MENU
                </button>
                {/* LEFT — previous playlist */}
                <button onClick={prevPlaylist} className="absolute left-3 text-gray-400 hover:text-ipod-blue transition-colors active:scale-90" title="Previous playlist">
                  <span className="material-symbols-outlined text-xl">skip_previous</span>
                </button>
                {/* RIGHT — next playlist */}
                <button onClick={nextPlaylist} className="absolute right-3 text-gray-400 hover:text-ipod-blue transition-colors active:scale-90" title="Next playlist">
                  <span className="material-symbols-outlined text-xl">skip_next</span>
                </button>
                {/* BOTTOM — toggle fullscreen */}
                <button
                  onClick={() => mood ? (isFullscreen ? exitToIpod() : expandToFullscreen()) : null}
                  className="absolute bottom-2 text-gray-400 hover:text-ipod-blue transition-colors active:scale-90"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  <span className="material-symbols-outlined text-xl">
                    {isFullscreen ? "fullscreen_exit" : "fullscreen"}
                  </span>
                </button>
                {/* CENTRE — open fullscreen */}
                <button
                  onClick={() => mood ? expandToFullscreen() : undefined}
                  aria-label="Open player"
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 hover:brightness-95"
                  style={{ background: "linear-gradient(145deg,#d8d8d8,#c0c0c0)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", color: "#6fa8dc" }}
                >
                  <span className="material-symbols-outlined text-2xl">
                    {mood ? "music_note" : "play_arrow"}
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-4 mx-6 h-1 rounded-full bg-[#c0c0c0]" />
          </div>
        </div>

        <p className="text-center font-pixel text-xs opacity-40 uppercase tracking-widest">
          {showPlaylistInIpod ? `🎵 ${playlistName || "Loading..."}` : "Click a mood to start listening"}
        </p>

        {/* ── Journal bridge ────────────────────────────────────────── */}
        {mood && (
          <div
            className="mt-6 p-4 bg-white/50 dark:bg-black/30"
            style={{ border: "2px dashed rgba(0,0,0,0.15)", borderRadius: 0 }}
          >
            {!journalPrompt ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-pixel text-sm text-pixel-black dark:text-[#F5E6D3]">
                    Does this music shift your mood?
                  </p>
                  <p className="font-pixel text-xs opacity-40 mt-0.5">Write about how you feel right now ✦</p>
                </div>
                <button
                  onClick={() => setJournalPrompt(true)}
                  className="font-pixel text-xs px-3 py-2 text-white whitespace-nowrap flex-shrink-0"
                  style={{ background: "#292929", border: "2px solid #292929", boxShadow: "2px 2px 0 rgba(0,0,0,0.1)" }}
                >
                  ✍ Write
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="font-pixel text-xs opacity-50 uppercase tracking-wider">
                  Add to today&apos;s journal {mood && `· ${MOOD_DISPLAY[mood]}`}
                </p>
                <textarea
                  autoFocus
                  value={journalNote}
                  onChange={(e) => setJournalNote(e.target.value)}
                  onKeyDown={(e) => { if (e.ctrlKey && e.key === "Enter") appendToJournal(); }}
                  placeholder="This music makes me feel..."
                  rows={3}
                  className="w-full bg-white dark:bg-zinc-900 border-2 border-black/20 p-2 font-pixel text-sm text-pixel-black dark:text-[#F5E6D3] resize-none focus:outline-none focus:border-black/50 placeholder-gray-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={appendToJournal}
                    className="flex-1 py-2 font-pixel text-sm text-white"
                    style={{ background: "#292929", border: "2px solid #292929", boxShadow: "2px 2px 0 rgba(0,0,0,0.1)" }}
                  >
                    {journalNote.trim() ? "Add to Journal →" : "Open Journal →"}
                  </button>
                  <button
                    onClick={() => { setJournalPrompt(false); setJournalNote(""); }}
                    className="px-4 py-2 font-pixel text-sm opacity-50 hover:opacity-80"
                    style={{ border: "2px solid rgba(0,0,0,0.2)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fullscreen playlist overlay ─────────────────────────────────────
          Always mounted (not conditional) so the Spotify embed keeps playing
          while the zoom-out animation runs. Visibility is toggled via CSS. */}
      {mood && playlistId && (
        <div
          className={`fixed inset-0 z-50 bg-gradient-to-br ${MOOD_GRADIENTS[mood]} backdrop-blur-md`}
          style={{
            height: "100dvh",
            transformOrigin: `${zoomOrigin.x} ${zoomOrigin.y}`,
            ...(!isFullscreen && !animating
              ? { visibility: "hidden" as const, pointerEvents: "none" as const }
              : {}),
            animation: animating === "zoom-in"
              ? "zoomIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards"
              : animating === "zoom-out"
              ? "zoomOut 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards"
              : undefined,
          }}
        >
          <div className="h-full flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={backToMoods} className="flex items-center gap-2 text-white/70 hover:text-white font-pixel text-sm uppercase tracking-wider transition-colors active:scale-95">
                  <span className="material-symbols-outlined text-xl">arrow_back</span>Back
                </button>
                <button onClick={exitToIpod} className="flex items-center gap-1 text-white/50 hover:text-white/80 font-pixel text-[10px] uppercase tracking-wider transition-colors active:scale-95 border border-white/20 rounded-lg px-2.5 py-1.5" title="Exit fullscreen">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>fullscreen_exit</span>iPod
                </button>
              </div>

              <div className="text-right">
                <p className="font-pixel text-white/40 text-[10px] uppercase tracking-widest">Now Playing</p>
                <p className="font-pixel text-white text-sm uppercase tracking-wider">
                  {MOOD_EMOJIS[mood]} {MOOD_DISPLAY[mood]}
                </p>
              </div>
            </div>

            {/* Playlist selector — shown when multiple playlists exist for this mood */}
            {allPlaylists.length > 1 && (
              <div className="px-6 pb-4 shrink-0">
                <select
                  value={playlistId || ""}
                  onChange={(e) => switchPlaylist(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-pixel text-xs uppercase tracking-wider focus:outline-none focus:border-white/40 cursor-pointer appearance-none backdrop-blur-sm"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='white'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 14px center",
                    paddingRight: "36px",
                  }}
                >
                  {allPlaylists.map((p) => (
                    <option key={p.id} value={p.id} className="bg-gray-900 text-white">{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Loading spinner */}
            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
                  <p className="font-pixel text-white/60 text-sm uppercase tracking-wider">Finding playlists...</p>
                </div>
              </div>
            )}

            {/* Spotify embed — fills remaining height */}
            {!loading && playlistId && (
              <div className="flex-1 min-h-0 px-6 pb-6">
                <iframe
                  key={playlistId}
                  src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
                  width="100%"
                  className="flex-1 min-h-0"
                  style={{ borderRadius: "16px", border: "none", height: "100%" }}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>
            )}

            {/* Empty state when no playlist could be found */}
            {!loading && !playlistId && (
              <div className="flex-1 flex items-center justify-center">
                {playlistError ? (
                  <p className="font-pixel text-white/60 text-sm text-center px-6">
                    Couldn&apos;t load a playlist — check your connection and try again.
                  </p>
                ) : (
                  <p className="font-pixel text-white/40 text-sm text-center">Couldn&apos;t find a playlist.<br />Try another mood.</p>
                )}
              </div>
            )}

            {/* Now-playing footer + journal shortcut */}
            {!loading && playlistName && (
              <div className="px-6 py-3 border-t border-white/10 shrink-0 flex items-center justify-between gap-4">
                <p className="font-pixel text-white/50 text-[10px] uppercase tracking-widest">🎵 {playlistName}</p>
                <button
                  onClick={() => { exitToIpod(); setTimeout(() => setJournalPrompt(true), 420); }}
                  className="font-pixel text-[10px] uppercase tracking-wider text-white/60 hover:text-white transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>edit_note</span>
                  Journal
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </DeskLayout>
  );
}

export default function MusicPage() {
  return (
    <Suspense fallback={null}>
      <MusicInner />
    </Suspense>
  );
}
