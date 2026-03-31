/**
 * useConsultationTimer — Server-synced consultation timer with countdown alerts.
 *
 * Extracted from VideoCallScreenInner to isolate:
 * - Server-synced timer (computes elapsed seconds from consultationStartedAt)
 * - Countdown alerts at 2min and 1min remaining
 * - Auto-finish trigger when time reaches 0
 *
 * Both doctor and patient use the same server timestamp for consistency.
 */

import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';

export interface ConsultationTimerReturn {
  callSeconds: number;
  setCallSeconds: React.Dispatch<React.SetStateAction<number>>;
}

export function useConsultationTimer(
  consultationStartedAt: string | null,
  contractedMinutes: number | null,
  onAutoFinish: () => void,
  /** Pass false when consultation has already been finished to prevent stale alerts. */
  isActive: boolean = true,
): ConsultationTimerReturn {
  const [callSeconds, setCallSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertedRef = useRef<Set<number>>(new Set());
  const autoFinishedRef = useRef(false);
  const onAutoFinishRef = useRef(onAutoFinish);
  onAutoFinishRef.current = onAutoFinish;

  // Reset refs when consultationStartedAt changes (e.g., rejoin)
  useEffect(() => {
    alertedRef.current = new Set();
    autoFinishedRef.current = false;
  }, [consultationStartedAt]);

  // Server-synced timer: compute elapsed seconds from backend timestamp
  // BUG FIX: Stop timer when isActive becomes false (consultation ended) to prevent
  // stale updates and alerts firing after consultation is finished.
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

  // Countdown alerts + auto-finish
  useEffect(() => {
    if (!contractedMinutes || contractedMinutes <= 0 || !isActive) return;
    const remaining = contractedMinutes * 60 - callSeconds;

    // FIX M14: use <= instead of === to avoid missing alerts if timer skips exact second
    if (remaining <= 120 && remaining > 60 && !alertedRef.current.has(120)) {
      alertedRef.current.add(120);
      Alert.alert('Atenção', 'A consulta termina em 2 minutos.');
    }
    if (remaining <= 60 && remaining > 0 && !alertedRef.current.has(60)) {
      alertedRef.current.add(60);
      Alert.alert('Atenção', 'A consulta termina em 1 minuto.');
    }
    if (remaining <= 0 && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      onAutoFinishRef.current();
      Alert.alert('Tempo esgotado', 'O tempo contratado expirou.');
    }
  }, [callSeconds, contractedMinutes, isActive]);

  return { callSeconds, setCallSeconds };
}
