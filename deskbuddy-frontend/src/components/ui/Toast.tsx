/**
 * Toast — fixed bottom notification banner.
 *
 * Pair with the `useToast` hook to manage visibility state.
 * Transitions in/out with CSS opacity so it never causes layout shifts.
 */

interface ToastProps {
  message: string;
  /** When false the toast is invisible but still mounted (preserves layout). */
  visible: boolean;
}

export default function Toast({ message, visible }: ToastProps) {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-8 left-1/2 -translate-x-1/2 font-pixel text-lg px-6 py-2 text-white transition-opacity duration-300 pointer-events-none"
      style={{
        background: "#292929",
        border:     "3px solid #292929",
        boxShadow:  "4px 4px 0 rgba(0,0,0,0.1)",
        opacity:    visible ? 1 : 0,
        zIndex:     100,
      }}
    >
      {message}
    </div>
  );
}
