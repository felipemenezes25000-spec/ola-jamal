/**
 * useConsultationTimer — Server-synced consultation elapsed timer.
 *
 * Computes elapsed seconds from consultationStartedAt (server timestamp).
 * No time limit — consultations run until the doctor ends them.
 */

import { useState, useEffect, useRef } from 'react';

export interface ConsultationTimerReturn {
  callSeconds: number;
  setCallSeconds: React.Dispatch<React.SetStateAction<number>>;
}

export function useConsultationTimer(
  consultationStartedAt: string | null,
  _contractedMinutes: number | null,
  _onAutoFinish: () => void,
  /** Pass false when consultation has already been finished to prevent stale updates. */
  isActive: boolean = true,
): ConsultationTimerReturn {
  const [callSeconds, setCallSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Server-synced timer: compute elapsed seconds from backend timestamp
  useEffect(() => {
    if (!consultationStartedAt || !isActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const update = () => {
      const elapsed = Math.floor((Date.now() - new Date(consultationStartedAt).getTime()) / 1000);
      setCallSeconds(Math.max(0, elapsed));
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [consultationStartedAt, isActive]);

  return { callSeconds, setCallSeconds };
}
