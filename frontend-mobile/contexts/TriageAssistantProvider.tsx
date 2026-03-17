/**
 * TriageAssistantProvider.tsx
 *
 * Context + Provider para o assistente de triagem Dra. Renoveja.
 * Gerencia: current message, dedupe, cooldown check, dismiss, mute.
 * Uso híbrido: regras primeiro (sempre), IA opcional para personalizar tom.
 * IA NUNCA define nada — médico sempre decide.
 *
 * Feature flags:
 *   EXPO_PUBLIC_TRIAGE_ENABLED (default: "true")
 *   EXPO_PUBLIC_TRIAGE_AI_ENABLED (default: "true") — enriquecimento com IA
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
import { canShow, markShown, muteKey, resetSessionCounts, resetSessionCountForKey, getJourneyStatus, setJourneyStatus } from '../lib/triage/triagePersistence';
import { trackTriageEvent } from '../lib/triage/triageAnalytics';
import { enrichTriageMessage } from '../lib/triage/triageEnrichmentApi';
import { getMessagePriority, getMessageTopic } from '../lib/triage/triagePriority';
import { getNextBestActionForRequest } from '../lib/domain/assistantIntelligence';
import { personalizeTriageCopy } from '../lib/triage/triageCopyPersonalization';
import type { TriageMessage, TriageInput } from '../lib/triage/triage.types';

// ── Feature flags ──────────────────────────────────────────

const IS_ENABLED = process.env.EXPO_PUBLIC_TRIAGE_ENABLED !== 'false';
const IS_AI_ENABLED = process.env.EXPO_PUBLIC_TRIAGE_AI_ENABLED !== 'false';
const SAME_TOPIC_COOLDOWN_MS = 15_000;   // 15s – permite trocar de tópico mais rápido (Dra. sempre presente)
const MIN_REPLACE_INTERVAL_MS = 12_000; // 12s – permite trocar mensagens mais frequentemente

async function buildFallbackJourneyMessage(input: TriageInput): Promise<TriageMessage | null> {
  if (input.role !== 'patient' || !input.status) return null;
  const next = getNextBestActionForRequest({
    status: input.status as any,
    requestType: input.requestType ?? 'prescription',
    signedDocumentUrl: null,
  });

  const previousStatus = input.requestId ? await getJourneyStatus(input.requestId) : null;
  const transitionPrefix = previousStatus && previousStatus !== input.status
    ? `Seu pedido evoluiu de ${previousStatus} para ${input.status}. `
    : '';

  const cta = next.intent === 'pay'
    ? 'abrir_pagamento'
    : next.intent === 'download'
      ? 'abrir_documento'
      : next.intent === 'track'
        ? 'acompanhar_pedido'
        : next.intent === 'wait'
          ? 'acompanhar_pedido'
          : null;
  const ctaLabel =
    cta === 'abrir_pagamento' ? 'Ir para pagamento' :
    cta === 'abrir_documento' ? 'Ver documento' :
    cta ? 'Acompanhar pedido' : undefined;

  if (input.requestId) {
    await setJourneyStatus(input.requestId, input.status);
  }

  return {
    key: `fallback:${input.context}:${input.requestType ?? 'request'}:${input.status}:${input.requestId ?? 'na'}`,
    text: `${transitionPrefix}${next.statusSummary} ${next.whatToDo}`,
    severity: next.intent === 'pay' ? 'attention' : next.intent === 'download' ? 'positive' : 'info',
    avatarState: next.intent === 'pay' ? 'alert' : next.intent === 'download' ? 'positive' : 'thinking',
    cta,
    ctaLabel,
    cooldownMs: 8_000,
    analyticsEvent: 'triage.fallback.journey',
    canMute: false,
    requestId: input.requestId,
    status: input.status,
  };
}

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
  const currentShownAtRef = useRef<number>(0);
  const topicSessionRef = useRef<Record<string, { shownAt: number; priority: number }>>({});

  // Reset session counts on mount (app start) — permite mensagens em cada abertura do app
  useEffect(() => {
    resetSessionCounts();
  }, []);

  const currentRef = useRef(current);
  useEffect(() => { currentRef.current = current; }, [current]);

  const evaluate = useCallback(async (input: TriageInput) => {
    if (!IS_ENABLED) return;

    const ruleMessage = evaluateTriageRules(input);
    const messageBase = ruleMessage ?? await buildFallbackJourneyMessage(input);
    if (!messageBase) return;
    const message = personalizeTriageCopy(messageBase, input);

    // Dedupe removido: Dra. Renoveja sempre ajuda, mesmo ao voltar à mesma tela

    const nextPriority = getMessagePriority(message);
    const nextTopic = getMessageTopic(message);
    const now = Date.now();

    // Memória leve por sessão: evita repetição de tópico em curto intervalo,
    // exceto se a nova mensagem é mais relevante.
    const topicState = topicSessionRef.current[nextTopic];
    if (topicState && now - topicState.shownAt < SAME_TOPIC_COOLDOWN_MS && nextPriority <= topicState.priority) {
      return;
    }

    // Ranking: evita trocar uma mensagem visível por outra de menor/igual prioridade
    // em sequência curta, reduzindo "pisca-pisca" do banner.
    const cur = currentRef.current;
    if (cur && cur.key !== message.key) {
      const currentPriority = getMessagePriority(cur);
      if (now - currentShownAtRef.current < MIN_REPLACE_INTERVAL_MS && nextPriority <= currentPriority) {
        return;
      }
    }

    // Cooldown + mute check
    const allowed = await canShow(message.key, message.cooldownMs);
    if (!allowed) return;

    // Show rule message immediately (nunca bloqueia)
    await markShown(message.key);
    screenKeyRef.current = message.key;
    currentShownAtRef.current = now;
    topicSessionRef.current[nextTopic] = { shownAt: now, priority: nextPriority };
    setCurrent(message);

    if (message.analyticsEvent) {
      trackTriageEvent(message.analyticsEvent, {
        key: message.key,
        severity: message.severity,
        hasCta: !!message.cta,
      });
    }

    // Add to history (max 3)
    setHistory(prev => {
      const next = [message, ...prev.filter(m => m.key !== message.key)];
      return next.slice(0, 3);
    });

    // Enriquecimento IA em background (opcional, não bloqueia)
    if (IS_AI_ENABLED) {
      enrichTriageMessage(message, input).then((enriched) => {
        if (!enriched) return;
        // Só atualiza se ainda estamos mostrando esta mensagem
        if (screenKeyRef.current === message.key) {
          setCurrent({
            ...message,
            text: enriched.text,
            isPersonalized: true,
          });
        }
      }).catch(() => { /* enrichment failed — use default message */ });
    }
  }, []);

  const dismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  const clearScreen = useCallback(() => {
    const keyToReset = screenKeyRef.current;
    setCurrent(null);
    screenKeyRef.current = null;
    currentShownAtRef.current = 0;
    if (keyToReset) resetSessionCountForKey(keyToReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
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
