import { apiClient } from './api-client';

// --- Tipos ---

export interface DailyJoinTokenResponse {
  token: string;
  roomUrl: string;
  roomName: string;
  isOwner: boolean;
  contractedMinutes: number | null;
}

export interface DailyRoomResponse {
  id: string;
  requestId: string;
  roomName: string;
  roomUrl: string;
  dailyRoomName: string;
  status: string;
  createdAt: string;
}

// --- API calls ---

/** Cria sala de vídeo no Daily.co (via backend). Idempotente. */
export async function createDailyRoom(requestId: string): Promise<DailyRoomResponse> {
  return apiClient.post('/api/video/rooms', { requestId });
}

/** Obtém join token + URL da sala para entrar na chamada. */
export async function fetchJoinToken(requestId: string): Promise<DailyJoinTokenResponse> {
  return apiClient.post('/api/video/join-token', { requestId });
}

/** Busca sala por request ID. Re-exporta de api-video (fonte canônica). */
export { fetchVideoRoomByRequest } from './api-video';

/** Cria sala de teste para transcrição via Daily.co (sem consulta ativa). */
export async function fetchTranscriptionTestRoom(): Promise<{
  roomUrl: string;
  token: string;
  roomName: string;
  expiresInMinutes: number;
}> {
  return apiClient.post('/api/video/transcription-test-room');
}
