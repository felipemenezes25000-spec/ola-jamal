/**
 * Cliente SignalR para o hub /hubs/requests.
 * Recebe evento "RequestUpdated" quando o status de uma solicitação muda (assinatura, etc.)
 * para atualizar a UI em tempo real sem refresh manual.
 */

import { apiClient } from './api-client';

export interface RequestUpdatedPayload {
  requestId: string;
  status: string;
  message?: string | null;
}

export type RequestUpdatedListener = (payload: RequestUpdatedPayload) => void;

let connection: any = null;
const listeners = new Set<RequestUpdatedListener>();

const EVENT_NAME = 'RequestUpdated';

function getHubUrl(): string {
  let base = apiClient.getBaseUrl();
  base = base.replace(/\/api\/?$/, '');
  return `${base}/hubs/requests`;
}

async function getToken(): Promise<string | null> {
  return apiClient.getAuthToken();
}

/**
 * Inicia a conexão com o hub de eventos de solicitações.
 * Deve ser chamado quando o usuário estiver logado.
 */
export async function startRequestsEventsConnection(): Promise<boolean> {
  if (connection) return true;
  const token = await getToken();
  if (!token) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SignalR HubConnection tipo dinâmico
  let conn: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic SignalR
    const signalR = require('@microsoft/signalr');
    const url = getHubUrl();
    // Retry policy: 5s, 15s, 30s — evita spam de negotiate em cold start (API)
    const retryDelays = [5000, 15000, 30000];
    const builder = new signalR.HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: async () => {
          const t = await getToken();
          if (!t) {
            if (__DEV__) console.warn('[RequestsEvents] Token ausente no reconnect');
            return '';
          }
          return t;
        },
      })
      .withAutomaticReconnect(retryDelays);
    // Só loga Warning/Error — evita poluir com "WebSocket connected", "Using HubProtocol", "Connection disconnected"
    if (signalR.LogLevel != null) {
      builder.configureLogging(signalR.LogLevel.Warning);
    }
    conn = builder.build();

    conn.onclose((error: Error | undefined) => {
      if (__DEV__) console.warn('[RequestsEvents] Conexão fechada:', error?.message);
      connection = null;
    });

    conn.on(EVENT_NAME, (payload: RequestUpdatedPayload) => {
      const normalized: RequestUpdatedPayload = {
        requestId: payload?.requestId ?? '',
        status: payload?.status ?? '',
        message: payload?.message ?? null,
      };
      listeners.forEach((fn) => {
        try {
          fn(normalized);
        } catch (e) {
          if (__DEV__) console.warn('[RequestsEvents] Listener error:', e);
        }
      });
    });

    // Timeout 15s — API pode demorar em cold start; evita travar o app
    const HUB_START_TIMEOUT_MS = 15_000;
    await Promise.race([
      conn.start(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Hub connection timeout')), HUB_START_TIMEOUT_MS)
      ),
    ]);
    connection = conn;
    return true;
  } catch (e) {
    // Timeout: conn.start() pode completar em background — limpar para evitar conexão órfã
    try { conn?.stop(); } catch {}
    if (__DEV__) {
      console.warn('[RequestsEvents] Connection failed. Updates em tempo real desativados. Use pull-to-refresh nas telas de pedidos para atualizar.', e);
    }
    return false;
  }
}

/**
 * Encerra a conexão. Chamar no logout.
 */
export async function stopRequestsEventsConnection(): Promise<void> {
  if (!connection) return;
  try {
    await connection.stop();
  } catch {}
  connection = null;
}

/**
 * Inscreve um listener para o evento RequestUpdated.
 * Retorna função para cancelar a inscrição.
 */
export function subscribeRequestsEvents(listener: RequestUpdatedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isRequestsEventsConnected(): boolean {
  // @microsoft/signalr usa strings ('Connected', 'Disconnected', etc.), não números
  return connection?.state === 'Connected';
}
