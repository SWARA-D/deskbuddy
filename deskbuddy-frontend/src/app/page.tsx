"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import DeskLayout   from "@/components/layout/DeskLayout";
import CalendarCard from "@/components/desk-items/Calendar";
import JournalCard  from "@/components/desk-items/Journal";
import CameraCard   from "@/components/desk-items/Camera";
import IPodCard     from "@/components/desk-items/iPod";
import BotCard      from "@/components/desk-items/Bot";

// ── position persistence ───────────────────────────────────────────────────────

const POSITIONS_KEY = "deskbuddy_desk_positions_v5";

type Pos = { x: number; y: number };

/**
 * Compute default positions that mirror the original CSS grid layout.
 *
 * Original grid order: Camera · Calendar · iPod  (row 1)
 *                      Journal · [skip] · Bot     (row 2, lg:col-start-3)
 *
 * Approximate item heights (lg):
 *   Camera   h-32 128px + label ≈ 155px
 *   Calendar header + 6-row grid + footer ≈ 310px
 *   iPod     h-72 288px
 *   Journal  h-80 320px
 *   Bot      robot 160px + speech bubble ≈ 220px
 *
 * Row 2 starts after the tallest row-1 item (Calendar ≈ 310px) plus a gap.
 */
function getDefaults(): Record<string, Pos> {
  const W = typeof window !== "undefined" ? window.innerWidth : 1280;

  // mirror DeskLayout <main> padding + grid gap
  const pad  = W >= 1024 ? 48 : W >= 640 ? 32 : 16;
  const gap  = W >= 1024 ? 48 : W >= 640 ? 40 : 32;
  const cols = W >= 1024 ? 3  : W >= 640 ? 2  : 1;

  const canvasW = W - 2 * pad;
  const colW    = (canvasW - (cols - 1) * gap) / cols;

  // left edge of item centred in column `col`
  const itemX = (col: number, w: number) =>
    Math.round(col * (colW + gap) + (colW - w) / 2);

  if (cols === 3) {
    // smaller widgets: calendar ~240px tall at scale 1.0
    const row2Y = 360;
    return {
      camera:   { x: itemX(0, 144), y: 80    },  // lg:w-36
      calendar: { x: itemX(1, 224), y: 40    },  // lg:w-56
      ipod:     { x: itemX(2, 144), y: 60    },  // lg:w-36
      journal:  { x: itemX(0, 192), y: row2Y },  // lg:w-48
      bot:      { x: itemX(2, 112), y: row2Y },  // lg:w-28
    };
  }

  if (cols === 2) {
    const row2Y = 300;
    const row3Y = row2Y + 260;
    return {
      camera:   { x: itemX(0, 144), y: 80    },
      calendar: { x: itemX(1, 224), y: 40    },
      ipod:     { x: itemX(0, 144), y: row2Y },
      journal:  { x: itemX(1, 192), y: row2Y },
      bot:      { x: itemX(1, 112), y: row3Y },
    };
  }

  // single column — stacked
  const rowH = 270;
  return {
    camera:   { x: itemX(0, 144), y: 40          },
    calendar: { x: itemX(0, 224), y: 40 + rowH   },
    ipod:     { x: itemX(0, 144), y: 40 + rowH*2 },
    journal:  { x: itemX(0, 192), y: 40 + rowH*3 },
    bot:      { x: itemX(0, 112), y: 40 + rowH*4 },
  };
}

function loadPositions(): Record<string, Pos> {
  const defaults = getDefaults();
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaults;
}

function persist(positions: Record<string, Pos>) {
  try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions)); } catch { /* ignore */ }
}

// ── DraggableItem ──────────────────────────────────────────────────────────────

function DraggableItem({
  id,
  pos,
  scale,
  onMove,
  children,
}: {
  id: string;
  pos: Pos;
  scale: number;
  onMove: (id: string, pos: Pos) => void;
  children: React.ReactNode;
}) {
  const dragging  = useRef(false);
  const moved     = useRef(false);
  const origin    = useRef({ mx: 0, my: 0, ix: 0, iy: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Global move/up listeners so drag works even when pointer leaves the element.
  // NOT using setPointerCapture — that redirects pointerup to the div, which
  // causes the browser to fire click on the div instead of the Link child.
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - origin.current.mx;
      const dy = e.clientY - origin.current.my;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
      if (moved.current) {
        setIsDragging(true);
        onMove(id, { x: origin.current.ix + dx, y: origin.current.iy + dy });
      }
    };

    const handleUp = () => {
      dragging.current = false;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup",   handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup",   handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [id, onMove]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragging.current = true;
    moved.current    = false;
    origin.current   = { mx: e.clientX, my: e.clientY, ix: pos.x, iy: pos.y };
  };

  // Capture phase: suppress Link navigation when the pointer actually moved
  const onClickCapture = (e: React.MouseEvent) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        touchAction: "none",
        zIndex: isDragging ? 100 : "auto",
        cursor: isDragging ? "grabbing" : undefined,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
      className="select-none"
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
    >
      {/* overlay only during active drag — keeps cursor and blocks accidental child hovers */}
      {isDragging && (
        <div className="absolute z-[200] cursor-grabbing" style={{ inset: "-24px" }} />
      )}
      {children}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DeskHome() {
  // dynamic scale: items grow with viewport (0.85 at 700px → 1.2 at 1440px)
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () =>
      setScale(Math.min(1.0, Math.max(0.7, window.innerWidth / 1300)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // placeholder matches a typical 3-col lg layout; patched after mount
  const [positions, setPositions] = useState<Record<string, Pos>>(() => ({
    camera:   { x: 60,  y: 80  },
    calendar: { x: 300, y: 40  },
    ipod:     { x: 580, y: 60  },
    journal:  { x: 60,  y: 360 },
    bot:      { x: 580, y: 360 },
  }));

  useEffect(() => {
    setPositions(loadPositions());
  }, []);

  const handleMove = useCallback((id: string, pos: Pos) => {
    setPositions(prev => {
      const next = { ...prev, [id]: pos };
      persist(next);
      return next;
    });
  }, []);

  const reset = () => {
    const defaults = getDefaults();
    persist(defaults);
    setPositions(defaults);
  };

  return (
    <DeskLayout>
      {/* free-form desk canvas */}
      <div className="relative w-full" style={{ minHeight: "calc(100vh - 9rem)" }}>

        {/* ── desk hint + reset — sits at top of canvas ── */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-4 pointer-events-none z-40 whitespace-nowrap">
          <p className="font-pixel text-[10px] sm:text-xs uppercase tracking-widest opacity-30 dark:opacity-40">
            ✦ drag items to arrange your desk ✦
          </p>
          <button
            onClick={reset}
            className="font-pixel text-[9px] uppercase tracking-widest opacity-25 hover:opacity-60 transition-opacity pointer-events-auto"
            title="Restore default layout"
          >
            reset
          </button>
        </div>

        <DraggableItem id="camera" pos={positions.camera} scale={scale} onMove={handleMove}>
          <CameraCard />
        </DraggableItem>

        <DraggableItem id="calendar" pos={positions.calendar} scale={scale} onMove={handleMove}>
          <CalendarCard />
        </DraggableItem>

        <DraggableItem id="ipod" pos={positions.ipod} scale={scale} onMove={handleMove}>
          <IPodCard />
        </DraggableItem>

        <DraggableItem id="journal" pos={positions.journal} scale={scale} onMove={handleMove}>
          <JournalCard />
        </DraggableItem>

        <DraggableItem id="bot" pos={positions.bot} scale={scale} onMove={handleMove}>
          <BotCard />
        </DraggableItem>
      </div>
    </DeskLayout>
  );
}
