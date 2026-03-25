"use client";

import Link from "next/link";

export default function CameraCard() {
  return (
    <Link
      href="/checkin"
      className="rotate-[-15deg] z-10 group cursor-pointer hover:scale-[1.03] transition-transform duration-200"
    >
      {/* camera body */}
      <div className="w-28 sm:w-32 lg:w-36 h-18 sm:h-20 lg:h-24 bg-camera-silver border-4 border-black/10 rounded-xl pixel-shadow flex flex-col items-center justify-center relative">
        {/* lens assembly */}
        <div className="w-12 sm:w-14 lg:w-16 h-12 sm:h-14 lg:h-16 rounded-full border-4 border-[#A0A4B3] bg-[#333] flex items-center justify-center relative overflow-hidden">
          <div className="w-9 sm:w-10 lg:w-11 h-9 sm:h-10 lg:h-11 rounded-full border-2 border-white/10 flex items-center justify-center">
            {/* inner lens reflection dot */}
            <div className="w-2.5 h-2.5 bg-white/20 rounded-full absolute top-2.5 left-2.5" />
          </div>
        </div>

        {/* top-right flash bar */}
        <div className="absolute top-2 right-4 w-8 h-4 bg-[#888] rounded-sm" />

        {/* orange viewfinder dot */}
        <div className="absolute top-2 left-4 w-4 h-4 bg-orange-400 rounded-full border-2 border-black/10" />
      </div>

      {/* label */}
      <p className="font-pixel text-center mt-2 opacity-40 dark:opacity-60 uppercase text-xs tracking-tighter">
        Snapshots
      </p>
    </Link>
  );
}