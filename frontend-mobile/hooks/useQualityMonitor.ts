/**
 * useQualityMonitor — Polls Daily.co network stats to track connection quality.
 *
 * Starts/stops automatically based on the `enabled` flag (tied to call state).
 * Polls every 5 seconds when active.
 */

import { useState, useEffect, useRef } from 'react';
import type { DailyCall } from '@daily-co/react-native-daily-js';

export type ConnectionQuality = 'good' | 'poor' | 'bad' | 'unknown';

export function useQualityMonitor(
  callRef: React.RefObject<DailyCall | null>,
  enabled: boolean,
): { quality: ConnectionQuality } {
  const [quality, setQuality] = useState<ConnectionQuality>('unknown');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setQuality('unknown');
      return;
    }

    intervalRef.current = setInterval(() => {
      const call = callRef.current;
      if (!call) return;

      Promise.resolve(call.getNetworkStats?.()).then(stats => {
        if (stats && typeof stats === 'object' && 'threshold' in stats) {
          const threshold = (stats as { threshold: string }).threshold;
          if (threshold === 'good') setQuality('good');
          else if (threshold === 'low') setQuality('poor');
          else setQuality('bad');
        }
      });
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, callRef]);

  return { quality };
}
