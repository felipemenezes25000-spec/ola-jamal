/**
 * Cliente SignalR para o hub /hubs/requests.
 * Recebe evento "RequestUpdated" quando o status de uma solicitação muda (pagamento, assinatura, etc.)
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

  try {
    const signalR = require('@microsoft/signalr');
    const url = getHubUrl();
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: async () => (await getToken()) ?? '',
      })
      .withAutomaticReconnect()
      .build();

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
          console.warn('[RequestsEvents] Listener error:', e);
        }
      });
    });

    await conn.start();
    connection = conn;
    return true;
  } catch (e) {
    if (__DEV__) {
      console.warn('[RequestsEvents] Connection failed. Updates em tempo real desativados. Polling será usado como fallback.', e);
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
  listeners.clear();
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
  return connection?.state === 1; // Connected
}
