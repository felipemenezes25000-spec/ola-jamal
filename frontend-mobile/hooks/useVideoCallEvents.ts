/**
 * useVideoCallEvents — SignalR real-time event handling for video consultations.
 *
 * Extracted from VideoCallScreenInner to isolate the SignalR connection logic
 * and real-time state updates (transcript, anamnesis, suggestions, evidence).
 *
 * Only connects for doctors — patients receive updates via request polling.
 */

import { useState, useRef, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import { AUTH_TOKEN_KEY } from '../lib/constants/storage-keys';

export interface EvidenceItem {
  title: string;
  abstract: string;
  source: string;
  translatedAbstract?: string;
  relevantExcerpts?: string[];
  clinicalRelevance?: string;
  provider?: string;
}

export interface VideoCallEventsReturn {
  transcript: string;
  setTranscript: React.Dispatch<React.SetStateAction<string>>;
  anamnesis: Record<string, unknown> | null;
  setAnamnesis: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
  suggestions: string[];
  setSuggestions: React.Dispatch<React.SetStateAction<string[]>>;
  evidence: EvidenceItem[];
  setEvidence: React.Dispatch<React.SetStateAction<EvidenceItem[]>>;
  isAiActive: boolean;
  transcriptionError: string | null;
  connectSignalR: () => Promise<void>;
  disconnectSignalR: () => Promise<void>;
}

export function useVideoCallEvents(
  requestId: string,
  isDoctor: boolean,
): VideoCallEventsReturn {
  const [transcript, setTranscript] = useState('');
  const [anamnesis, setAnamnesis] = useState<Record<string, unknown> | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [isAiActive, setIsAiActive] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const signalRRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const connectSignalR = useCallback(async () => {
    if (!requestId || !isDoctor) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic import for SignalR
      const signalR = require('@microsoft/signalr');
      let apiBase = apiClient.getBaseUrl();
      apiBase = apiBase.replace(/\/api\/?$/, '');

      let authToken = '';
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional native module
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        authToken = (await AsyncStorage.getItem(AUTH_TOKEN_KEY)) ?? '';
      } catch {}

      if (!authToken) {
        console.warn('[SignalR] No auth token found — cannot connect');
        return;
      }

      const builder = new signalR.HubConnectionBuilder()
        .withUrl(`${apiBase}/hubs/video`, {
          accessTokenFactory: () => authToken,
        })
        .withAutomaticReconnect();
      if (signalR.LogLevel != null) {
        const logLevel = __DEV__ ? signalR.LogLevel.Information : signalR.LogLevel.Warning;
        builder.configureLogging(logLevel);
      }
      const conn = builder.build();

      conn.on('TranscriptUpdate', (data: Record<string, unknown>) => {
        const text = String(data?.fullText ?? data?.FullText ?? data?.fullTranscript ?? '');
        if (text) {
          setTranscript(text);
          setIsAiActive(true);
          setTranscriptionError(null);
        }
      });

      conn.on('AnamnesisUpdate', (data: Record<string, unknown>) => {
        const json = String(data?.anamnesisJson ?? data?.AnamnesisJson ?? '');
        try { if (json) setAnamnesis(JSON.parse(json) as Record<string, unknown>); } catch {}
      });

      conn.on('SuggestionUpdate', (data: Record<string, unknown>) => {
        // Backend envia SuggestionUpdateDto(Items) — JSON camelCase: items
        const items = data?.items ?? data?.Items ?? data?.suggestions ?? data?.Suggestions ?? [];
        if (Array.isArray(items)) setSuggestions(items);
      });

      conn.on('TranscriptionError', (data: Record<string, unknown>) => {
        const msg = String(data?.message ?? data?.Message ?? 'Erro na transcrição');
        setTranscriptionError(msg);
      });

      conn.on('EvidenceUpdate', (data: Record<string, unknown>) => {
        const items = (data?.items ?? data?.Items ?? []) as Record<string, unknown>[];
        if (Array.isArray(items)) {
          setEvidence(items.map((e): EvidenceItem => ({
            title: String(e?.title ?? e?.Title ?? ''),
            abstract: String(e?.abstract ?? e?.Abstract ?? ''),
            source: String(e?.source ?? e?.Source ?? ''),
            translatedAbstract: e?.translatedAbstract != null ? String(e.translatedAbstract) : undefined,
            relevantExcerpts: Array.isArray(e?.relevantExcerpts) ? (e.relevantExcerpts as string[]) : (Array.isArray(e?.RelevantExcerpts) ? (e.RelevantExcerpts as string[]) : undefined),
            clinicalRelevance: e?.clinicalRelevance != null ? String(e.clinicalRelevance) : (e?.ClinicalRelevance != null ? String(e.ClinicalRelevance) : undefined),
            provider: String(e?.provider ?? e?.Provider ?? 'PubMed'),
          })));
        }
      });

      await conn.start();
      await conn.invoke('JoinRoom', requestId);
      signalRRef.current = conn;
    } catch (e) {
      console.warn('SignalR connection failed (non-critical):', e);
    }
  }, [requestId, isDoctor]);

  const disconnectSignalR = useCallback(async () => {
    try { await signalRRef.current?.stop(); } catch {}
    signalRRef.current = null;
  }, []);

  return {
    transcript,
    setTranscript,
    anamnesis,
    setAnamnesis,
    suggestions,
    setSuggestions,
    evidence,
    setEvidence,
    isAiActive,
    transcriptionError,
    connectSignalR,
    disconnectSignalR,
  };
}
