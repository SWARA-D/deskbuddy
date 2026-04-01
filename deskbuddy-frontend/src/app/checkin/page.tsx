"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo } from "react";
import DeskLayout from "@/components/layout/DeskLayout";
import BackButton from "@/components/ui/BackButton";
import Toast from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { checkinApi } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Snapshot {
  id: string;
  image: string;    // base64 JPEG
  emotion: string;
  caption: string;
  date: string;     // YYYY-MM-DD
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SNAPSHOTS_KEY = "deskbuddy_snapshots";
const PINNED_KEY    = "deskbuddy_pinned";

function readPinned(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) ?? "[]")); }
  catch { return new Set(); }
}

function writePinned(ids: Set<string>): void {
  localStorage.setItem(PINNED_KEY, JSON.stringify([...ids]));
}

const EMOTIONS = [
  { name: "happy",       emoji: "😄" },
  { name: "excited",     emoji: "🤩" },
  { name: "calm",        emoji: "🧘" },
  { name: "grateful",    emoji: "🙏" },
  { name: "hopeful",     emoji: "🌟" },
  { name: "neutral",     emoji: "😌" },
  { name: "sad",         emoji: "😢" },
  { name: "anxious",     emoji: "😰" },
  { name: "overwhelmed", emoji: "😵" },
  { name: "angry",       emoji: "😤" },
];

// ── Storage helpers ───────────────────────────────────────────────────────────

function readSnapshots(): Snapshot[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) ?? "[]"); }
  catch { return []; }
}

function writeSnapshots(snaps: Snapshot[]): void {
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CheckinPage() {
  const { toast, toastVisible, showToast } = useToast();

  const [snapshots,     setSnapshots]     = useState<Snapshot[]>([]);
  const [pinned,        setPinned]        = useState<Set<string>>(new Set());
  const [savedSnap,     setSavedSnap]     = useState<Snapshot | null>(null); // for post-save journal prompt
  const [mode,         setMode]         = useState<"gallery" | "new">("gallery");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [emotion,      setEmotion]      = useState("");
  const [caption,      setCaption]      = useState("");
  const [capturing,    setCapturing]    = useState(false);
  const [camError,     setCamError]     = useState("");
  const [saving,       setSaving]       = useState(false);
  const [selected,     setSelected]     = useState<Snapshot | null>(null);
  const [backendStreak, setBackendStreak] = useState<number | null>(null);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

  useEffect(() => {
    setSnapshots(readSnapshots());
    setPinned(readPinned());
    // B10: try to get authoritative streak from backend (works across devices/browsers)
    checkinApi.streak().then((res) => {
      if (res.data?.current) setBackendStreak(res.data.current);
    }).catch(() => { /* backend offline — use localStorage streak */ });
  }, []);

  // Stop camera stream on unmount.
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // Attach stream to video element once it mounts (capturing becomes true).
  useEffect(() => {
    if (capturing && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [capturing]);

  // ── Camera helpers ────────────────────────────────────────────────────
  const startCamera = async () => {
    setCamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCapturing(true); // render video element first, then useEffect attaches the stream
    } catch {
      setCamError("Camera access was denied or is unavailable.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCapturing(false);
  };

  const captureFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth  || 1280;
    const h = video.videoHeight || 720;
    canvas.width  = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    if (!dataUrl || dataUrl === "data:,") {
      setCamError("Could not capture frame — make sure the camera is active.");
      return;
    }
    setImagePreview(dataUrl);
    stopCamera();
  };

  // ── File upload ───────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected.
    e.target.value = "";
  };

  // ── Save snapshot ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!imagePreview || !emotion) return;
    setSaving(true);

    try {
      // Try to upload to Cloudinary (server-side, keeps credentials off the client).
      // On failure (Cloudinary not configured, network error, etc.) store the
      // base64 data URL in localStorage as a graceful fallback.
      let imageUrl = imagePreview;
      try {
        const res = await fetch("/api/upload/image", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ data: imagePreview }),
        });
        if (res.ok) {
          const { url } = await res.json() as { url?: string };
          if (url) imageUrl = url;
        }
      } catch {
        // Network error or Cloudinary not configured — base64 fallback
      }

      const snap: Snapshot = {
        id:        `snap-${Date.now()}`,
        image:     imageUrl,
        emotion,
        caption:   caption.trim(),
        date:      today,
        createdAt: new Date().toISOString(),
      };
      const updated = [snap, ...readSnapshots()];
      writeSnapshots(updated);
      setSnapshots(updated);
      setMode("gallery");
      setImagePreview(null);
      setEmotion("");
      setCaption("");
      setSavedSnap(snap); // trigger journal prompt
      // B10: sync check-in date to backend (fire-and-forget)
      checkinApi.create(today, caption.trim() || undefined)
        .then((res) => { if (res.data?.streak?.current) setBackendStreak(res.data.streak.current); })
        .catch(() => { /* backend offline */ });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    const updated = readSnapshots().filter((s) => s.id !== id);
    writeSnapshots(updated);
    setSnapshots(updated);
    // Also remove from pinned if needed
    const p = readPinned();
    if (p.has(id)) { p.delete(id); writePinned(p); setPinned(new Set(p)); }
    setSelected(null);
  };

  // ── Pin / unpin ───────────────────────────────────────────────────────
  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const p = readPinned();
    if (p.has(id)) {
      p.delete(id);
    } else {
      if (p.size >= 3) {
        showToast("✦ Max 3 pins — unpin one first");
        return;
      }
      p.add(id);
    }
    writePinned(p);
    setPinned(new Set(p));
  };

  // ── Reset new-snap form ───────────────────────────────────────────────
  const resetNew = () => {
    stopCamera();
    setImagePreview(null);
    setEmotion("");
    setCaption("");
    setCamError("");
    setMode("gallery");
  };

  // ── Derived values ────────────────────────────────────────────────────
  const now = new Date();
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const snapshotDates = new Set(snapshots.map((s) => s.date));

  // Count consecutive days ending today with at least one snapshot (localStorage fallback).
  const localStreak = useMemo(() => {
    let count = 0;
    const d = new Date();
    while (snapshotDates.has(d.toLocaleDateString("en-CA"))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [snapshotDates]);

  // B10: prefer backend streak (cross-device accurate) over local count
  const streak = backendStreak ?? localStreak;

  const emotionOf = (name: string) => EMOTIONS.find((e) => e.name === name);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <DeskLayout>
      <div className="max-w-3xl mx-auto pt-10 px-4 pb-20">
        <BackButton />

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-pixel text-3xl uppercase tracking-widest text-pixel-black dark:text-[#F5E6D3]">
              Photo Booth
            </h2>
            <p className="font-pixel text-xs opacity-40 uppercase tracking-widest">Daily Snapshots</p>
          </div>
          {mode === "gallery" && (
            <button
              onClick={() => setMode("new")}
              className="flex items-center gap-2 px-4 py-2 font-pixel text-sm uppercase tracking-wider text-white transition-opacity hover:opacity-80 pixel-shadow"
              style={{ background: "#292929", border: "3px solid #292929", boxShadow: "3px 3px 0 rgba(0,0,0,0.12)" }}
            >
              <span className="material-symbols-outlined text-base">add_a_photo</span>
              New Snap
            </button>
          )}
        </div>

        {/* Pin counter */}
        {pinned.size > 0 && (
          <p className="font-pixel text-xs text-gray-400 mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">push_pin</span>
            {pinned.size}/3 pinned to journal
          </p>
        )}

        {/* Streak badge */}
        <div className="inline-flex items-center gap-2 bg-primary/15 border border-primary/30 rounded-full px-4 py-1.5 pixel-shadow mb-6">
          <span className="material-symbols-outlined text-primary text-lg">local_fire_department</span>
          <p className="font-pixel text-lg text-primary uppercase">{streak}-Day Streak</p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            NEW SNAPSHOT FORM
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "new" && (
          <div
            className="bg-white dark:bg-zinc-900 mb-8"
            style={{ border: "4px solid #292929", boxShadow: "4px 4px 0 rgba(0,0,0,0.10)" }}
          >
            <div className="p-6 flex flex-col gap-6">

              {/* Step 1 — Photo */}
              <div>
                <p className="font-pixel text-xs opacity-40 uppercase tracking-widest mb-3">
                  1 · Take or upload a photo
                </p>

                {/* Webcam live view */}
                {capturing && (
                  <div className="relative mb-3">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full max-h-64 object-cover"
                      style={{ border: "3px solid #292929" }}
                    />
                    {/* Shutter button */}
                    <button
                      onClick={captureFrame}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white border-4 border-pixel-black flex items-center justify-center hover:bg-gray-100 transition-colors pixel-shadow"
                      aria-label="Take photo"
                    >
                      <span className="material-symbols-outlined text-2xl">photo_camera</span>
                    </button>
                    <button
                      onClick={stopCamera}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black"
                      aria-label="Cancel camera"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                )}

                {/* Image preview */}
                {imagePreview && !capturing && (
                  <div className="relative mb-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full max-h-64 object-cover"
                      style={{ border: "3px solid #292929" }}
                    />
                    <button
                      onClick={() => setImagePreview(null)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black"
                      aria-label="Remove photo"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                )}

                {/* Source picker (shown when no image selected yet) */}
                {!imagePreview && !capturing && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={startCamera}
                      className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-black/20 hover:border-black/50 dark:border-white/20 dark:hover:border-white/50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-4xl opacity-40">photo_camera</span>
                      <span className="font-pixel text-sm uppercase opacity-50">Take Photo</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-black/20 hover:border-black/50 dark:border-white/20 dark:hover:border-white/50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-4xl opacity-40">upload</span>
                      <span className="font-pixel text-sm uppercase opacity-50">Upload Image</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                )}

                {camError && (
                  <p className="font-pixel text-sm text-red-500 mt-2">{camError}</p>
                )}
              </div>

              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Step 2 — Emotion */}
              <div>
                <p className="font-pixel text-xs opacity-40 uppercase tracking-widest mb-3">
                  2 · How are you feeling? <span className="text-red-400">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map((e) => (
                    <button
                      key={e.name}
                      type="button"
                      onClick={() => setEmotion(e.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 font-pixel text-sm uppercase tracking-wide border-2 transition-all"
                      style={{
                        background:  emotion === e.name ? "#292929" : "transparent",
                        color:       emotion === e.name ? "white"   : undefined,
                        borderColor: emotion === e.name ? "#292929" : "rgba(0,0,0,0.15)",
                        boxShadow:   emotion === e.name ? "2px 2px 0 rgba(0,0,0,0.15)" : "none",
                      }}
                    >
                      <span>{e.emoji}</span>
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3 — Caption */}
              <div>
                <p className="font-pixel text-xs opacity-40 uppercase tracking-widest mb-2">
                  3 · Caption <span className="opacity-50">(optional)</span>
                </p>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  placeholder="What's this moment about?"
                  maxLength={120}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-black/10 px-4 py-2.5 font-display text-base outline-none dark:text-[#F5E6D3] placeholder:opacity-40 focus:border-black/40 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={!imagePreview || !emotion || saving}
                  className="px-6 py-2.5 font-pixel text-base uppercase tracking-wider text-white transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "#292929", border: "3px solid #292929", boxShadow: "3px 3px 0 rgba(0,0,0,0.12)" }}
                >
                  {saving ? "Saving…" : "Save Snapshot"}
                </button>
                <button
                  onClick={resetNew}
                  className="px-6 py-2.5 font-pixel text-base uppercase tracking-wider transition-opacity hover:opacity-70"
                  style={{ border: "3px solid #292929", boxShadow: "3px 3px 0 rgba(0,0,0,0.12)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Post-save journal bridge ──────────────────────────────────── */}
        {savedSnap && mode === "gallery" && (
          <div
            className="mb-6 p-4 flex items-center justify-between gap-4 bg-white/50 dark:bg-black/30"
            style={{ border: "2px dashed rgba(0,0,0,0.15)" }}
          >
            <div className="min-w-0">
              <p className="font-pixel text-sm text-pixel-black dark:text-[#F5E6D3]">
                {savedSnap.emotion && `Feeling ${savedSnap.emotion}?`} Write about this moment ✦
              </p>
              <p className="font-pixel text-xs opacity-40 mt-0.5">Add this snapshot&apos;s story to today&apos;s journal entry</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/journal"
                className="font-pixel text-xs px-3 py-2 text-white"
                style={{ background: "#292929", border: "2px solid #292929", boxShadow: "2px 2px 0 rgba(0,0,0,0.1)" }}
              >
                ✍ Journal
              </Link>
              <button
                onClick={() => setSavedSnap(null)}
                className="opacity-30 hover:opacity-60 transition-opacity"
                aria-label="Dismiss"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            GALLERY
        ══════════════════════════════════════════════════════════════════ */}
        {mode === "gallery" && (
          <>
            {snapshots.length === 0 ? (
              <div
                className="flex flex-col items-center gap-4 py-20 bg-white/50 dark:bg-black/20 mb-8"
                style={{ border: "4px solid #292929", boxShadow: "4px 4px 0 rgba(0,0,0,0.10)" }}
              >
                <span className="material-symbols-outlined text-6xl opacity-15">photo_camera</span>
                <p className="font-pixel text-xl opacity-30 uppercase text-center leading-loose">
                  No snapshots yet.<br />Hit "New Snap" to capture your first moment!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8">
                {snapshots.map((snap) => {
                  const em      = emotionOf(snap.emotion);
                  const rot     = ((snap.id.charCodeAt(6) % 9) - 4);
                  const isPinned = pinned.has(snap.id);
                  const canPin   = isPinned || pinned.size < 3;
                  return (
                    <div
                      key={snap.id}
                      className="relative"
                      style={{ transform: `rotate(${rot}deg)` }}
                    >
                      {/* Pin button */}
                      <button
                        onClick={(e) => togglePin(snap.id, e)}
                        title={isPinned ? "Unpin" : canPin ? "Pin to journal (top 3)" : "Max 3 pins reached"}
                        className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                        style={{
                          background: isPinned ? "#292929" : "white",
                          border: "2px solid #292929",
                          boxShadow: "2px 2px 0 rgba(0,0,0,0.15)",
                          opacity: !canPin ? 0.35 : 1,
                          cursor: !canPin ? "not-allowed" : "pointer",
                        }}
                      >
                        <span className="material-symbols-outlined text-sm" style={{ color: isPinned ? "white" : "#292929" }}>
                          push_pin
                        </span>
                      </button>

                      {/* Polaroid */}
                      <button
                        onClick={() => setSelected(snap)}
                        className="w-full text-left focus:outline-none"
                      >
                        <div
                          className="bg-white p-2.5 pb-9 relative hover:scale-[1.04] transition-transform"
                          style={{
                            boxShadow: isPinned ? "4px 4px 0 #292929" : "4px 4px 0 rgba(0,0,0,0.18)",
                            border: isPinned ? "2px solid #292929" : "2px solid rgba(0,0,0,0.06)",
                          }}
                        >
                          {isPinned && (
                            <div className="absolute top-1 left-1 z-10 font-pixel text-[9px] bg-pixel-black text-white px-1">
                              PINNED
                            </div>
                          )}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={snap.image}
                            alt={snap.caption || snap.emotion}
                            className="w-full aspect-square object-cover"
                            loading="lazy"
                          />
                          <div className="absolute bottom-1.5 left-0 right-0 px-2 text-center">
                            <p className="font-pixel text-xs text-pixel-black/60 truncate leading-tight">
                              {em?.emoji} {snap.caption || snap.emotion}
                            </p>
                            <p className="font-pixel text-[10px] text-pixel-black/30">{snap.date}</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MONTHLY HEATMAP
        ══════════════════════════════════════════════════════════════════ */}
        <div>
          <p className="font-pixel text-xs opacity-40 uppercase tracking-widest mb-3">
            {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d   = i + 1;
              const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const has = snapshotDates.has(ymd);
              return (
                <div
                  key={d}
                  className={`w-8 h-8 rounded-md flex items-center justify-center font-pixel text-xs
                    ${has
                      ? "bg-primary/30 border border-primary/40 text-primary"
                      : "bg-white/20 dark:bg-black/15 border border-black/5 opacity-50"
                    }`}
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Lightbox (selected snapshot detail) ───────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setSelected(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setSelected(null); }}
        >
          <div
            className="bg-white dark:bg-zinc-900 max-w-sm w-full p-5 relative"
            style={{ border: "4px solid #292929", boxShadow: "8px 8px 0 rgba(0,0,0,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 opacity-40 hover:opacity-100 transition-opacity"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.image}
              alt={selected.caption || selected.emotion}
              className="w-full aspect-square object-cover mb-4"
              style={{ border: "3px solid #292929" }}
              loading="lazy"
            />

            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">{emotionOf(selected.emotion)?.emoji}</span>
              <span className="font-pixel text-xl uppercase text-pixel-black dark:text-[#F5E6D3]">
                {selected.emotion}
              </span>
            </div>

            {selected.caption && (
              <p className="font-display text-sm italic text-pixel-black/70 dark:text-[#F5E6D3]/70 mb-2">
                "{selected.caption}"
              </p>
            )}

            <p className="font-pixel text-xs opacity-30 mb-5">{selected.date}</p>

            <button
              onClick={() => handleDelete(selected.id)}
              className="flex items-center gap-1 font-pixel text-xs uppercase text-red-500 hover:text-red-700 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Delete snapshot
            </button>
          </div>
        </div>
      )}

      <Toast message={toast} visible={toastVisible} />
    </DeskLayout>
  );
}
