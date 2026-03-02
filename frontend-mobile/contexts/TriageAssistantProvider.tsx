/**
 * TriageAssistantProvider.tsx
 *
 * Context + Provider para o assistente de triagem Dra. Renova.
 * Gerencia: current message, dedupe, cooldown check, dismiss, mute.
 *
 * Feature flag: EXPO_PUBLIC_TRIAGE_ENABLED (default: "true")
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import { evaluateTriageRules } from '../lib/triage/triageRulesEngine';
import { canShow, markShown, muteKey, resetSessionCounts } from '../lib/triage/triagePersistence';
import type { TriageMessage, TriageInput } from '../lib/triage/triage.types';

// ── Feature flag ────────────────────────────────────────────

const IS_ENABLED = process.env.EXPO_PUBLIC_TRIAGE_ENABLED !== 'false';

// ── Context types ───────────────────────────────────────────

interface TriageContextType {
  /** Mensagem atual visível (null = nada a mostrar) */
  current: TriageMessage | null;
  /** Se o assistente está habilitado */
  enabled: boolean;
  /** Avalia regras e mostra mensagem se aplicável */
  evaluate: (input: TriageInput) => Promise<void>;
  /** Dismiss: esconde a mensagem atual (sessão) */
  dismiss: () => void;
  /** Muta permanentemente a mensagem atual */
  muteCurrent: () => Promise<void>;
  /** Limpa mensagem + reseta dedupe de tela (chamar ao sair da tela) */
  clearScreen: () => void;
  /** Histórico recente (max 3, mais recente primeiro) */
  recentHistory: TriageMessage[];
}

const Ctx = createContext<TriageContextType>({
  current: null,
  enabled: IS_ENABLED,
  evaluate: async () => {},
  dismiss: () => {},
  muteCurrent: async () => {},
  clearScreen: () => {},
  recentHistory: [],
});

// ── Provider ────────────────────────────────────────────────

export function TriageAssistantProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<TriageMessage | null>(null);
  const [history, setHistory] = useState<TriageMessage[]>([]);
  const screenKeyRef = useRef<string | null>(null);

  // Reset session counts on mount (app start)
  useEffect(() => { resetSessionCounts(); }, []);

  const evaluate = useCallback(async (input: TriageInput) => {
    if (!IS_ENABLED) return;

    const message = evaluateTriageRules(input);
    if (!message) return;

    // Dedupe: mesma key na mesma "tela" → não mostrar de novo
    if (screenKeyRef.current === message.key) return;

    // Cooldown + mute check
    const allowed = await canShow(message.key, message.cooldownMs);
    if (!allowed) return;

    // Show it
    await markShown(message.key);
    screenKeyRef.current = message.key;
    setCurrent(message);

    // Add to history (max 3)
    setHistory(prev => {
      const next = [message, ...prev.filter(m => m.key !== message.key)];
      return next.slice(0, 3);
    });
  }, []);

  const dismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  const clearScreen = useCallback(() => {
    setCurrent(null);
    screenKeyRef.current = null;
  }, []);

  const muteCurrent = useCallback(async () => {
    if (current) {
      await muteKey(current.key);
      setCurrent(null);
    }
  }, [current]);

  const value = useMemo<TriageContextType>(() => ({
    current,
    enabled: IS_ENABLED,
    evaluate,
    dismiss,
    muteCurrent,
    clearScreen,
    recentHistory: history,
  }), [current, evaluate, dismiss, muteCurrent, clearScreen, history]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook para consumir o assistente de triagem. */
export function useTriageAssistant(): TriageContextType {
  return useContext(Ctx);
}
