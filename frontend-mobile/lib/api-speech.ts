import { apiClient } from './api-client';

export interface SpeechToTextResult {
  transcribed: boolean;
  raw: string;
  polished: string;
  text: string;
}

/**
 * Envia áudio gravado para transcrição + polish por IA.
 * Backend: Deepgram (STT) → GPT-4o-mini (limpeza clínica).
 */
export async function transcribeSymptomAudio(
  audioFile: { uri: string; name: string; type: string },
  context?: string,
): Promise<SpeechToTextResult> {
  const formData = new FormData();
  formData.append('file', audioFile as unknown as Blob);
  if (context) formData.append('context', context);

  return apiClient.post('/api/speech-to-text/symptom', formData, true);
}
