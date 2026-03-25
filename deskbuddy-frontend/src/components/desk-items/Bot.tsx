"use client";

import Link from "next/link";

export default function BotCard() {
  return (
    <Link
      href="/bot"
      className="z-30 group cursor-pointer hover:scale-[1.03] transition-transform duration-200"
    >
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        {/* robot body */}
        <div className="relative w-20 sm:w-24 lg:w-28 h-20 sm:h-24 lg:h-28 bg-camera-silver border-4 border-black/15 rounded-3xl flex flex-col items-center justify-center pixel-shadow">
          {/* screen / face */}
          <div className="w-14 sm:w-16 lg:w-18 h-10 sm:h-11 lg:h-12 bg-[#1A1A1A] rounded-xl border-4 border-[#8E929F] flex flex-col items-center justify-center gap-1.5">
            {/* eyes */}
            <div className="flex gap-3 sm:gap-3.5">
              <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 bg-primary rounded-sm shadow-[0_0_10px_#4ade80]" />
              <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 bg-primary rounded-sm shadow-[0_0_10px_#4ade80]" />
            </div>
            {/* mouth */}
            <div className="w-8 sm:w-9 h-1 bg-primary rounded-full shadow-[0_0_6px_#4ade80]" />
          </div>

          {/* left ear */}
          <div className="absolute -left-1.5 sm:-left-2 top-1/2 -translate-y-1/2 w-1.5 sm:w-2 h-6 sm:h-7 bg-[#8E929F] rounded-l-lg" />
          {/* right ear */}
          <div className="absolute -right-1.5 sm:-right-2 top-1/2 -translate-y-1/2 w-1.5 sm:w-2 h-6 sm:h-7 bg-[#8E929F] rounded-r-lg" />
        </div>

        {/* speech bubble */}
        <div className="bg-white/80 dark:bg-black/40 backdrop-blur-sm px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl border-2 border-black/5 pixel-shadow relative">
          <p className="font-pixel text-sm sm:text-base tracking-wide uppercase">&quot;Ready to work!&quot;</p>
          {/* little triangle pointing up */}
          <div className="absolute -top-1.5 right-5 sm:right-6 w-3 h-3 bg-white/80 dark:bg-black/40 rotate-45 border-l-2 border-t-2 border-black/5" />
        </div>
      </div>

      {/* label */}
      <p className="font-pixel text-center mt-1 opacity-30 dark:opacity-50 uppercase text-[10px] tracking-widest">
        Desk Buddy
      </p>
    </Link>
  );
}