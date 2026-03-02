/**
 * useTriageEval — Hook that auto-evaluates triage on focus/change.
 *
 * Usage:
 *   useTriageEval({ context: 'prescription', step, role: 'patient', prescriptionType });
 *
 * Auto-clears on unfocus. Re-evaluates when deps change.
 */

import { useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTriageAssistant } from '../contexts/TriageAssistantProvider';
import type { TriageInput } from '../lib/triage/triage.types';

export function useTriageEval(input: TriageInput): void {
  const { evaluate, clearScreen } = useTriageAssistant();
  const prevKeyRef = useRef('');

  // Create a stable dependency key
  const depKey = `${input.context}:${input.step}:${input.prescriptionType}:${input.examType}:${input.status}:${input.aiRiskLevel}`;

  useEffect(() => {
    if (depKey === prevKeyRef.current) return;
    prevKeyRef.current = depKey;
    evaluate(input);
  }, [depKey, evaluate, input]);

  // Clear when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => { clearScreen(); };
    }, [clearScreen])
  );
}
