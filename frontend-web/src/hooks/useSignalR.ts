/**
 * Hook para conexão SignalR com o hub de requests.
 * Recebe eventos em tempo real: novos pedidos, mudanças de status, etc.
 *
 * Backend: /hubs/requests
 * Events: "RequestUpdated" { requestId, status, message }
 */
import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/services/doctorApi';

interface RequestEvent {
  requestId: string;
  status: string;
  message?: string;
}

type EventHandler = (event: RequestEvent) => void;

// Dynamic import of @microsoft/signalr to avoid bundling if not needed
let signalR: typeof import('@microsoft/signalr') | null = null;

async function getSignalR() {
  if (!signalR) {
    try {
      signalR = await import('@microsoft/signalr');
    } catch {
      console.warn('[SignalR] @microsoft/signalr not installed. Real-time disabled.');
      return null;
    }
  }
  return signalR;
}

function getApiBase(): string {
  const env = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

export function useRequestEvents(onEvent?: EventHandler) {
  const connectionRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const handlersRef = useRef<Set<EventHandler>>(new Set());
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RequestEvent | null>(null);

  // Register callback
  useEffect(() => {
    if (onEvent) {
      handlersRef.current.add(onEvent);
      return () => { handlersRef.current.delete(onEvent); };
    }
  }, [onEvent]);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const sr = await getSignalR();
      if (!sr || cancelled) return;

      const token = getToken();
      if (!token) return;

      const base = getApiBase();
      if (!base) return;

      const connection = new sr.HubConnectionBuilder()
        .withUrl(`${base}/hubs/requests`, {
          // FIX #5: Sempre lê o token atual do localStorage ao reconectar,
          // em vez de capturar uma closure do token antigo.
          accessTokenFactory: () => getToken() ?? '',
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(sr.LogLevel.Warning)
        .build();

      connection.on('RequestUpdated', (payload: RequestEvent) => {
        setLastEvent(payload);
        handlersRef.current.forEach(h => {
          try { h(payload); } catch (e) { console.error('[SignalR] Handler error:', e); }
        });
      });

      connection.onclose(() => {
        if (!cancelled) setConnected(false);
      });

      connection.onreconnected(() => {
        setConnected(true);
      });

      try {
        await connection.start();
        if (!cancelled) {
          connectionRef.current = connection;
          setConnected(true);
        }
      } catch (err) {
        console.warn('[SignalR] Connection failed:', err);
      }
    }

    connect();

    return () => {
      cancelled = true;
      connectionRef.current?.stop();
      connectionRef.current = null;
    };
  }, []);

  return { connected, lastEvent };
}

/**
 * Hook para conexão SignalR com o hub de vídeo.
 * Recebe: TranscriptUpdate, AnamnesisUpdate, SuggestionUpdate, EvidenceUpdate
 */
export function useVideoSignaling(requestId: string | undefined) {
  const connectionRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const [connected, setConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [anamnesis, setAnamnesis] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<unknown[]>([]);
  const evidence: unknown[] = [];
  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;

    // FIX #23: Limpar estados ao trocar de requestId para não exibir dados do request anterior
    setTranscript('');
    setAnamnesis(null);
    setSuggestions([]);    setConnected(false);

    async function connect() {
      const sr = await getSignalR();
      if (!sr || cancelled) return;

      const token = getToken();
      if (!token) return;

      const base = getApiBase();
      const connection = new sr.HubConnectionBuilder()
        .withUrl(`${base}/hubs/video`, {
          // FIX #5: Token sempre fresco ao reconectar
          accessTokenFactory: () => getToken() ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(sr.LogLevel.Warning)
        .build();

      connection.on('TranscriptUpdate', (data: { fullText?: string; FullText?: string; fullTranscript?: string }) => {
        setTranscript(data.fullText ?? data.FullText ?? data.fullTranscript ?? '');
      });

      connection.on('AnamnesisUpdate', (data: { anamnesisJson?: string; AnamnesisJson?: string }) => {
        setAnamnesis(data.anamnesisJson ?? data.AnamnesisJson ?? null);
      });

      connection.on('SuggestionUpdate', (data: { items?: unknown[]; Items?: unknown[]; suggestions?: unknown[] }) => {
        // Backend envia SuggestionUpdateDto(Items) — JSON camelCase: items
        const items = data.items ?? data.Items ?? data.suggestions ?? [];
        setSuggestions(Array.isArray(items) ? items : []);
      });



      try {
        await connection.start();
        if (!cancelled) {
          await connection.invoke('JoinRoom', requestId);
          connectionRef.current = connection;
          setConnected(true);
        }
      } catch (err) {
        console.warn('[SignalR Video] Connection failed:', err);
      }
    }

    connect();

    return () => {
      cancelled = true;
      connectionRef.current?.stop();
      connectionRef.current = null;
    };
  }, [requestId]);

  return { connected, transcript, anamnesis, suggestions, evidence };
}
