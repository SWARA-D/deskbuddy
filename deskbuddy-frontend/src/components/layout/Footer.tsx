"use client";

import Link from "next/link";

const dockItems = [
  { icon: "calendar_today", href: "/tasks", label: "Calendar" },
  { icon: "checklist", href: "/tasks", label: "Tasks" },
  { icon: "local_cafe", href: "/checkin", label: "Check-in", accent: true },
  { icon: "lightbulb", href: "/bot", label: "Bot" }
];

export default function Footer() {
  return (
    <footer className="flex items-center justify-center pb-4 sm:pb-6 lg:pb-8 z-50 relative">
      <div className="bg-white/30 dark:bg-black/20 backdrop-blur-md border-2 border-black/10 px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-2xl flex items-center gap-3 sm:gap-4 lg:gap-6 pixel-shadow">
        {dockItems.map((item, i) => (
          <span key={item.icon}>
            {/* visual divider after the second item */}
            {i === 2 && <span className="h-6 sm:h-7 lg:h-8 w-px bg-black/10 mx-0.5 sm:mx-1 inline-block" />}
            <Link
              href={item.href}
              aria-label={item.label}
              className="p-1.5 sm:p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-xl transition-all inline-flex"
            >
              <span
                className={`material-symbols-outlined text-base sm:text-lg lg:text-xl ${
                  item.accent ? "text-ipod-blue" : ""
                }`}
              >
                {item.icon}
              </span>
            </Link>
          </span>
        ))}
      </div>
    </footer>
  );
}