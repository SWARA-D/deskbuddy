"use client";

import Link from "next/link";

export default function IPodCard() {
  return (
    <Link
      href="/music"
      className="rotate-[8deg] z-20 group cursor-pointer hover:scale-[1.02] transition-transform duration-200"
    >
      <div className="w-36 sm:w-40 lg:w-44 h-56 sm:h-64 lg:h-72 bg-ipod-blue border-4 border-black/10 rounded-2xl p-3 sm:p-3.5 lg:p-4 pixel-shadow flex flex-col items-center gap-3 sm:gap-3.5 lg:gap-4">
        {/* album-art screen */}
        <div className="w-full h-24 sm:h-28 lg:h-32 bg-[#E1E1E1] border-2 border-black/5 rounded-lg overflow-hidden p-2 flex flex-col items-center justify-center">
          <div className="size-12 sm:size-14 lg:size-16 bg-white border-2 border-black/5 rounded shadow-inner flex items-center justify-center">
            <span className="material-symbols-outlined text-ipod-blue text-2xl sm:text-3xl lg:text-4xl">music_note</span>
          </div>
          <p className="font-pixel text-[0.625rem] sm:text-xs mt-1 sm:mt-2 text-center uppercase text-pixel-black">
            Lo-Fi Morning
          </p>
        </div>

        {/* click-wheel */}
        <div className="size-20 sm:size-24 lg:size-28 bg-white rounded-full border-2 border-black/5 flex items-center justify-center relative">
          {/* centre nub */}
          <div className="size-8 sm:size-9 lg:size-10 bg-[#f0f0f0] rounded-full border border-black/5" />
          {/* cardinal labels */}
          <span className="material-symbols-outlined absolute top-0.5 sm:top-1 text-xs sm:text-sm opacity-30 text-pixel-black">menu</span>
          <span className="material-symbols-outlined absolute bottom-0.5 sm:bottom-1 text-xs sm:text-sm opacity-30 text-pixel-black">play_pause</span>
          <span className="material-symbols-outlined absolute left-0.5 sm:left-1 text-xs sm:text-sm opacity-30 text-pixel-black">fast_rewind</span>
          <span className="material-symbols-outlined absolute right-0.5 sm:right-1 text-xs sm:text-sm opacity-30 text-pixel-black">fast_forward</span>
        </div>
      </div>

      {/* label */}
      <p className="font-pixel text-center mt-3 opacity-30 dark:opacity-50 uppercase text-[10px] tracking-widest">
        Lo-Fi Studio
      </p>
    </Link>
  );
}