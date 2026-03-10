import { apiClient } from './api-client';
import type { RequestResponseDto } from '../types/database';

// ============================================
// CONSULTATION — transcription & conduct
// ============================================

/** Dados para atualizar conduta médica.
 *  Espelha UpdateConductDto do backend (RequestDtos.cs).
 */
export interface UpdateConductData {
  conductNotes?: string | null;
  includeConductInPdf?: boolean;
  /** Se informado, médico sobrescreve a observação automática (null = remover, string = editar). */
  autoObservationOverride?: string | null;
  /** Se true, aplica o override da observação. Se false/omitido, mantém a observação original. */
  applyObservationOverride?: boolean;
}

export async function updateConduct(
  requestId: string,
  data: UpdateConductData,
): Promise<RequestResponseDto> {
  return apiClient.put(`/api/requests/${requestId}/conduct`, data);
}

export function parseAiSuggestedExams(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((e: unknown) => typeof e === 'string') : [];
  } catch { return []; }
}

/** Envia texto já transcrito (Daily.co) com speaker. Usado quando transcrição é feita no cliente. */
export async function transcribeTextChunk(
  requestId: string,
  text: string,
  speaker: 'medico' | 'paciente',
  startTimeSeconds?: number
): Promise<{ ok: boolean; fullLength?: number }> {
  return apiClient.post('/api/consultation/transcribe-text', {
    requestId,
    text,
    speaker,
    ...(startTimeSeconds != null && startTimeSeconds >= 0 && { startTimeSeconds }),
  });
}

/** Envia chunk de áudio para transcrição em tempo real. Paciente envia (stream=remote); médico só visualiza. */
export async function transcribeAudioChunk(
  requestId: string,
  audioBlob: Blob | { uri: string; name: string; type: string },
  stream: 'local' | 'remote' = 'remote'
): Promise<{ transcribed: boolean; text?: string; fullLength?: number }> {
  const formData = new FormData();
  formData.append('requestId', requestId);
  formData.append('stream', stream);
  // React Native FormData accepts { uri, name, type } objects for file uploads
  formData.append('file', audioBlob as unknown as Blob);
  return apiClient.post('/api/consultation/transcribe', formData, true);
}

/** Obtém signed URL para download do .txt da transcrição (bucket privado). Médico ou paciente. */
export async function getTranscriptDownloadUrl(
  requestId: string,
  expiresIn = 3600
): Promise<{ signedUrl: string; expiresIn: number }> {
  return apiClient.get(
    `/api/requests/${requestId}/transcript-download-url?expiresIn=${Math.min(86400, Math.max(60, expiresIn))}`
  );
}

/**
 * Testa transcrição sem consulta ativa (apenas backend em Development).
 * Útil para validar transcrição (Deepgram) sem consulta ativa.
 */
export async function transcribeTestAudio(
  audioBlob: Blob | { uri: string; name: string; type: string }
): Promise<{ transcribed: boolean; text?: string; fileSize?: number; fileName?: string }> {
  const formData = new FormData();
  formData.append('file', audioBlob as unknown as Blob);
  return apiClient.post('/api/consultation/transcribe-test', formData, true);
}
