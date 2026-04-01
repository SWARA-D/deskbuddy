/**
 * useToast — lightweight hook for transient notification messages.
 *
 * Usage:
 *   const { toast, toastVisible, showToast } = useToast();
 *   // in component: <Toast message={toast} visible={toastVisible} />
 *   // to trigger:   showToast("✦ Entry saved!");
 */

import { useState, useCallback, useEffect, useRef } from "react";

export function useToast(durationMs = 2800) {
  const [toast,        setToast]        = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      setToastVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToastVisible(false), durationMs);
    },
    [durationMs]
  );

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { toast, toastVisible, showToast };
}
