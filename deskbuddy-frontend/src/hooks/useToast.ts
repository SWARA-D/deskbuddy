/**
 * useToast — lightweight hook for transient notification messages.
 *
 * Usage:
 *   const { toast, toastVisible, showToast } = useToast();
 *   // in component: <Toast message={toast} visible={toastVisible} />
 *   // to trigger:   showToast("✦ Entry saved!");
 */

import { useState, useCallback } from "react";

export function useToast(durationMs = 2800) {
  const [toast,        setToast]        = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), durationMs);
    },
    [durationMs]
  );

  return { toast, toastVisible, showToast };
}
