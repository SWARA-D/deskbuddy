"use client";

import Link from "next/link";

export default function CameraCard() {
  return (
    <Link
      href="/checkin"
      className="rotate-[-15deg] z-10 group cursor-pointer hover:scale-[1.03] transition-transform duration-200"
    >
      {/* camera body */}
      <div className="w-36 sm:w-40 lg:w-48 h-24 sm:h-28 lg:h-32 bg-camera-silver border-4 border-black/10 rounded-xl pixel-shadow flex flex-col items-center justify-center relative">
        {/* lens assembly */}
        <div className="w-16 sm:w-20 lg:w-24 h-16 sm:h-20 lg:h-24 rounded-full border-4 sm:border-6 lg:border-8 border-[#A0A4B3] bg-[#333] flex items-center justify-center relative overflow-hidden">
          <div className="w-12 sm:w-14 lg:w-16 h-12 sm:h-14 lg:h-16 rounded-full border-2 sm:border-3 lg:border-4 border-white/10 flex items-center justify-center">
            {/* inner lens reflection dot */}
            <div className="w-3 sm:w-3.5 lg:w-4 h-3 sm:h-3.5 lg:h-4 bg-white/20 rounded-full absolute top-3 sm:top-3.5 lg:top-4 left-3 sm:left-3.5 lg:left-4" />
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