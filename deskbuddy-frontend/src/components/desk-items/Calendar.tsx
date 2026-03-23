"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export default function CalendarCard() {
  const today = new Date();
  const [year]  = useState(today.getFullYear());
  const [month] = useState(today.getMonth());       // 0-indexed
  const dayOfMonth = today.getDate();

  /* first weekday (0=Sun) of this month, and total days */
  const { firstDay, totalDays } = useMemo(() => {
    const first = new Date(year, month, 1).getDay();
    const last  = new Date(year, month + 1, 0).getDate();
    return { firstDay: first, totalDays: last };
  }, [year, month]);

  /* previous-month trailing days to fill the first row */
  const prevMonthDays = new Date(year, month, 0).getDate();

  return (
    <Link
      href="/tasks"
      className="z-20 group cursor-pointer hover:scale-[1.02] transition-transform duration-200"
    >
      {/* card */}
      <div className="w-52 sm:w-64 lg:w-72 bg-calendar-white border-2 border-black/10 p-3 sm:p-4 lg:p-6 pixel-shadow flex flex-col gap-2 sm:gap-3">
        {/* header row */}
        <div className="flex items-center justify-between border-b-2 border-pixel-black/10 pb-2 mb-2">
          <p className="font-pixel text-xl sm:text-2xl text-pixel-black tracking-widest uppercase">
            {MONTHS[month]}
          </p>
          <p className="font-pixel text-sm sm:text-base text-pixel-black/40">{year}</p>
        </div>

        {/* weekday headers + day grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
          {/* day-of-week labels */}
          {DAYS.map((d) => (
            <span key={d} className="font-pixel text-[0.625rem] sm:text-xs opacity-30">{d}</span>
          ))}

          {/* trailing days from previous month */}
          {Array.from({ length: firstDay }, (_, i) => {
            const day = prevMonthDays - firstDay + 1 + i;
            return (
              <span key={`prev-${i}`} className="font-pixel text-sm sm:text-lg py-0.5 sm:py-1 text-pixel-black/20">
                {day}
              </span>
            );
          })}

          {/* current month days */}
          {Array.from({ length: totalDays }, (_, i) => {
            const day = i + 1;
            const isToday = day === dayOfMonth;
            return (
              <span
                key={`cur-${day}`}
                className={`font-pixel text-sm sm:text-lg py-0.5 sm:py-1 text-pixel-black ${
                  isToday ? "bg-primary/20 rounded-sm outline outline-1 outline-primary/40" : ""
                }`}
              >
                {day}
              </span>
            );
          })}
        </div>

        {/* motivational footer */}
        <div className="mt-3 pt-3 border-t border-dashed border-pixel-black/10">
          <p className="font-pixel text-xs text-pixel-black/60 uppercase text-center tracking-widest">
            Stay Cozy Today
          </p>
        </div>
      </div>

      {/* label below card */}
      <p className="font-pixel text-center mt-3 opacity-30 dark:opacity-50 uppercase text-[10px] tracking-widest">
        Master Schedule
      </p>
    </Link>
  );
}