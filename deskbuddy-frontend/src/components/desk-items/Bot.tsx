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
        <div className="relative w-28 sm:w-32 lg:w-40 h-28 sm:h-32 lg:h-40 bg-camera-silver border-4 border-black/15 rounded-3xl flex flex-col items-center justify-center pixel-shadow">
          {/* screen / face */}
          <div className="w-20 sm:w-24 lg:w-28 h-14 sm:h-16 lg:h-20 bg-[#1A1A1A] rounded-xl border-4 border-[#8E929F] flex flex-col items-center justify-center gap-1.5 sm:gap-2">
            {/* eyes */}
            <div className="flex gap-4 sm:gap-5 lg:gap-6">
              <div className="w-3 sm:w-3.5 lg:w-4 h-3 sm:h-3.5 lg:h-4 bg-primary rounded-sm shadow-[0_0_12px_#4ade80]" />
              <div className="w-3 sm:w-3.5 lg:w-4 h-3 sm:h-3.5 lg:h-4 bg-primary rounded-sm shadow-[0_0_12px_#4ade80]" />
            </div>
            {/* mouth */}
            <div className="w-10 sm:w-11 lg:w-12 h-1 sm:h-1.5 bg-primary rounded-full shadow-[0_0_8px_#4ade80]" />
          </div>

          {/* left ear */}
          <div className="absolute -left-2 sm:-left-2.5 lg:-left-3 top-1/2 -translate-y-1/2 w-2 sm:w-2.5 lg:w-3 h-8 sm:h-9 lg:h-10 bg-[#8E929F] rounded-l-lg" />
          {/* right ear */}
          <div className="absolute -right-2 sm:-right-2.5 lg:-right-3 top-1/2 -translate-y-1/2 w-2 sm:w-2.5 lg:w-3 h-8 sm:h-9 lg:h-10 bg-[#8E929F] rounded-r-lg" />
        </div>

        {/* speech bubble */}
        <div className="bg-white/80 dark:bg-black/40 backdrop-blur-sm px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 rounded-xl border-2 border-black/5 pixel-shadow relative">
          <p className="font-pixel text-base sm:text-lg lg:text-xl tracking-wide uppercase">&quot;Ready to work!&quot;</p>
          {/* little triangle pointing up */}
          <div className="absolute -top-1.5 sm:-top-2 right-6 sm:right-8 w-3 sm:w-4 h-3 sm:h-4 bg-white/80 dark:bg-black/40 rotate-45 border-l-2 border-t-2 border-black/5" />
        </div>
      </div>

      {/* label */}
      <p className="font-pixel text-center mt-1 opacity-30 dark:opacity-50 uppercase text-[10px] tracking-widest">
        Desk Buddy
      </p>
    </Link>
  );
}