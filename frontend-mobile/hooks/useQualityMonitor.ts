/**
 * useQualityMonitor — Polls Daily.co network stats to track connection quality.
 *
 * Starts/stops automatically based on the `enabled` flag (tied to call state).
 * Polls every 5 seconds when active.
 * Reports quality drops to Sentry as breadcrumbs.
 */

import { useState, useEffect, useRef } from 'react';
import type { DailyCall } from '@daily-co/react-native-daily-js';
import { addBreadcrumb as sentryAddBreadcrumb } from '@sentry/core';

export type ConnectionQuality = 'good' | 'poor' | 'bad' | 'unknown';

export function useQualityMonitor(
  callRef: React.RefObject<DailyCall | null>,
  enabled: boolean,
): { quality: ConnectionQuality } {
  const [quality, setQuality] = useState<ConnectionQuality>('unknown');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevQualityRef = useRef<ConnectionQuality>('unknown');

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setQuality('unknown');
      prevQualityRef.current = 'unknown';
      return;
    }

    intervalRef.current = setInterval(() => {
      const call = callRef.current;
      if (!call) return;

      Promise.resolve(call.getNetworkStats?.()).then(stats => {
        if (stats && typeof stats === 'object' && 'threshold' in stats) {
          const threshold = (stats as { threshold: string }).threshold;
          let newQuality: ConnectionQuality;
          if (threshold === 'good') newQuality = 'good';
          else if (threshold === 'low') newQuality = 'poor';
          else newQuality = 'bad';

          // Log quality transitions to Sentry as breadcrumbs
          if (newQuality !== prevQualityRef.current && prevQualityRef.current !== 'unknown') {
            sentryAddBreadcrumb({
              category: 'video.quality',
              message: `Connection quality: ${prevQualityRef.current} → ${newQuality}`,
              level: newQuality === 'bad' ? 'warning' : 'info',
              data: { from: prevQualityRef.current, to: newQuality, threshold },
            });
          }

          prevQualityRef.current = newQuality;
          setQuality(newQuality);
        }
      }).catch(() => { /* ignore — call may be in transitional state */ });
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
