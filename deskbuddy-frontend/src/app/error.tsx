'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-desk-wood dark:bg-desk-wood-dark font-display text-[#2C241B] dark:text-[#F5E6D3]">
        <div className="flex items-center justify-center h-screen w-full">
          <div className="flex flex-col items-center gap-6 text-center px-6 max-w-md">
            <span className="font-pixel text-5xl">:(</span>
            <h2 className="font-pixel text-lg uppercase tracking-widest">Something went wrong</h2>
            {error.message && (
              <p className="font-pixel text-xs opacity-50 uppercase tracking-wider">{error.message}</p>
            )}
            <button
              onClick={() => reset()}
              className="mt-2 px-5 py-2.5 bg-pixel-black dark:bg-[#F5E6D3] text-[#F5E6D3] dark:text-pixel-black font-pixel text-xs uppercase tracking-widest rounded-lg pixel-shadow hover:opacity-80 transition-opacity"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
