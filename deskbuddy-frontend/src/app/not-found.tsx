import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <p className="font-pixel text-xs opacity-40 uppercase tracking-widest mb-2">
        404
      </p>

      <h2 className="font-pixel text-3xl uppercase tracking-widest text-pixel-black dark:text-[#F5E6D3] mb-3">
        Page not found
      </h2>

      <p className="font-display text-sm opacity-70 max-w-md mb-6 dark:text-[#F5E6D3]">
        This page wandered off the desk. Let’s get you back.
      </p>

      <Link
        href="/"
        className="px-5 py-2 bg-primary/30 hover:bg-primary/50 border border-primary/40 rounded-lg font-pixel text-sm uppercase tracking-widest transition-colors"
      >
        Back to Desk
      </Link>
    </div>
  );
}
