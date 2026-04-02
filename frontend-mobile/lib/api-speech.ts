import { Platform } from 'react-native';
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
 *
 * Na web o URI é uma blob: URL — precisamos converter para File real.
 * No nativo o React Native serializa o objeto {uri, name, type} automaticamente.
 */
export async function transcribeSymptomAudio(
  audioFile: { uri: string; name: string; type: string },
  context?: string,
): Promise<SpeechToTextResult> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    // Na web, expo-av retorna blob: URL — fetch e converter para File
    const response = await fetch(audioFile.uri);
    const blob = await response.blob();
    const file = new File([blob], audioFile.name, { type: audioFile.type });
    formData.append('file', file);
  } else {
    // No nativo, RN serializa {uri, name, type} como multipart
    formData.append('file', audioFile as unknown as Blob);
  }

  if (context) formData.append('context', context);

  return apiClient.post('/api/speech-to-text/symptom', formData, true);
}
