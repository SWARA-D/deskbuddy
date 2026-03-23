"use client";

import Link from "next/link";

export default function JournalCard() {
  return (
    <Link
      href="/journal"
      className="rotate-[-5deg] z-20 group cursor-pointer hover:scale-[1.02] transition-transform duration-200"
    >
      <div className="relative">
        {/* notebook body */}
        <div className="w-48 sm:w-56 lg:w-64 h-64 sm:h-72 lg:h-80 bg-journal-black border-4 border-black/30 rounded-r-2xl rounded-l-md pixel-shadow p-6 sm:p-8 flex flex-col justify-between">
          {/* top line decoration */}
          <div className="w-full h-1 bg-white/10 rounded" />

          {/* title block */}
          <div className="flex flex-col gap-2">
            <p className="font-pixel text-xl sm:text-2xl text-white/40 tracking-widest uppercase">Journal</p>
            <p className="font-pixel text-[0.625rem] sm:text-xs text-white/20 uppercase">Property of Desk Buddy</p>
          </div>

          {/* bottom-right icon */}
          <div className="flex justify-end">
            <span className="material-symbols-outlined text-white/10">auto_stories</span>
          </div>
        </div>

        {/* pen — absolutely positioned next to the right edge */}
        <div className="absolute -right-8 top-1/4 w-3 h-48 bg-gray-400 border-2 border-black/10 rounded-full rotate-[12deg] shadow-lg">
          <div className="absolute bottom-0 w-full h-8 bg-gray-600 rounded-b-full" />
          <div className="absolute top-0 w-full h-12 bg-gray-200 rounded-t-full" />
        </div>
      </div>

      {/* label */}
      <p className="font-pixel text-center mt-3 opacity-30 dark:opacity-50 uppercase text-[10px] tracking-widest">
        My Journal
      </p>
    </Link>
  );
}