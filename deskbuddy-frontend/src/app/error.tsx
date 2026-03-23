'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 24 }}>
      <h2>Something went wrong</h2>
      <p style={{ opacity: 0.7 }}>{error.message}</p>
      <button onClick={() => reset()} style={{ marginTop: 12 }}>
        Try again
      </button>
    </div>
  );
}
