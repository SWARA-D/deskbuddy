/**
 * BackButton — shared "Back to Desk" navigation link.
 *
 * Used on every inner page so the navigation pattern stays consistent
 * without duplicating the Link + icon markup five times.
 */

import Link from "next/link";

interface BackButtonProps {
  /** Destination path. Defaults to "/" (the desk home). */
  href?: string;
  /** Label shown next to the arrow icon. */
  label?: string;
}

export default function BackButton({ href = "/", label = "Back to Desk" }: BackButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 font-pixel text-sm opacity-50 hover:opacity-80 transition-opacity mb-6"
    >
      <span className="material-symbols-outlined text-lg">arrow_back</span>
      {label}
    </Link>
  );
}
