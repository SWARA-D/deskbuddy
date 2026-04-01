export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen w-full bg-desk-wood dark:bg-desk-wood-dark">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 border-4 border-pixel-black/20 border-t-pixel-black dark:border-[#F5E6D3]/20 dark:border-t-[#F5E6D3] rounded-full animate-spin" />
        <p className="font-pixel text-sm uppercase tracking-widest opacity-50 dark:text-[#F5E6D3]">
          Loading...
        </p>
      </div>
    </div>
  );
}
