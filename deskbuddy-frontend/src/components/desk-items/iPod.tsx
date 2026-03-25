"use client";

import Link from "next/link";

export default function IPodCard() {
  return (
    <Link
      href="/music"
      className="rotate-[8deg] z-20 group cursor-pointer hover:scale-[1.02] transition-transform duration-200"
    >
      <div className="w-28 sm:w-32 lg:w-36 h-44 sm:h-52 lg:h-56 bg-ipod-blue border-4 border-black/10 rounded-2xl p-2.5 sm:p-3 pixel-shadow flex flex-col items-center gap-2.5 sm:gap-3">
        {/* album-art screen */}
        <div className="w-full h-20 sm:h-22 lg:h-24 bg-[#E1E1E1] border-2 border-black/5 rounded-lg overflow-hidden p-2 flex flex-col items-center justify-center">
          <div className="size-9 sm:size-10 lg:size-11 bg-white border-2 border-black/5 rounded shadow-inner flex items-center justify-center">
            <span className="material-symbols-outlined text-ipod-blue text-xl sm:text-2xl">music_note</span>
          </div>
          <p className="font-pixel text-[0.5rem] sm:text-[0.625rem] mt-1 text-center uppercase text-pixel-black">
            Lo-Fi Morning
          </p>
        </div>

        {/* click-wheel */}
        <div className="size-16 sm:size-18 lg:size-20 bg-white rounded-full border-2 border-black/5 flex items-center justify-center relative">
          {/* centre nub */}
          <div className="size-6 sm:size-7 bg-[#f0f0f0] rounded-full border border-black/5" />
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