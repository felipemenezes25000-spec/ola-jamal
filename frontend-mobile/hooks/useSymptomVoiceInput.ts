/**
 * useSymptomVoiceInput — Grava áudio do microfone e transcreve para texto.
 *
 * Fluxo: Toque no mic → grava até soltar (ou max 60s) → envia para backend
 * Backend: Deepgram (STT) → GPT-4o-mini (polish clínico) → texto limpo
 *
 * Retorna o texto polido para preencher o campo de sintomas.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { transcribeSymptomAudio } from '../lib/api-speech';

const MAX_DURATION_MS = 60_000; // 60 seconds max

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: 2, // MPEG_4
    audioEncoder: 3, // AAC
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: 0x60, // HIGH
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    outputFormat: undefined,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export interface UseSymptomVoiceInputReturn {
  /** Whether currently recording */
  isRecording: boolean;
  /** Whether transcription is in progress */
  isTranscribing: boolean;
  /** Recording duration in seconds */
  durationSeconds: number;
  /** Last error message */
  error: string | null;
  /** Start recording */
  startRecording: () => Promise<void>;
  /** Stop recording and transcribe — returns polished text or null */
  stopAndTranscribe: (context?: string) => Promise<string | null>;
  /** Cancel recording without transcribing */
  cancelRecording: () => Promise<void>;
}

export function useSymptomVoiceInput(): UseSymptomVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    const rec = recordingRef.current;
    if (rec) {
      try {
        const status = await rec.getStatusAsync();
        if (status.isRecording) {
          await rec.stopAndUnloadAsync();
        }
      } catch {}
      recordingRef.current = null;
    }
    setDurationSeconds(0);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        const msg = 'Permissão de microfone necessária para gravar seus sintomas.';
        setError(msg);
        Alert.alert('Permissão necessária', msg);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = recording;
      setIsRecording(true);
      setDurationSeconds(0);

      // Duration counter
      timerRef.current = setInterval(() => {
        setDurationSeconds((s) => s + 1);
      }, 1000);

      // Auto-stop at max duration
      maxTimerRef.current = setTimeout(() => {
        if (recordingRef.current) {
          Alert.alert('Tempo máximo', 'A gravação atingiu 60 segundos e será processada automaticamente.');
        }
      }, MAX_DURATION_MS);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao iniciar gravação';
      setError(msg);
      setIsRecording(false);
    }
  }, []);

  const stopAndTranscribe = useCallback(async (context?: string): Promise<string | null> => {
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }

    const rec = recordingRef.current;
    if (!rec) {
      setError('Nenhuma gravação em andamento.');
      return null;
    }

    try {
      const status = await rec.getStatusAsync();
      if (status.isRecording) {
        await rec.stopAndUnloadAsync();
      }
      const uri = rec.getURI();
      recordingRef.current = null;

      if (!uri) {
        setError('Arquivo de áudio não encontrado.');
        return null;
      }

      // Check file size
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const fileSize = fileInfo.exists ? ((fileInfo as unknown as { size?: number }).size ?? 0) : 0;
      if (fileSize < 1000) {
        setError('Gravação muito curta. Tente falar por mais tempo.');
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        return null;
      }

      // Send to backend
      setIsTranscribing(true);
      setError(null);

      const extension = Platform.OS === 'web' ? 'webm' : 'm4a';
      const mimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';

      const result = await transcribeSymptomAudio(
        { uri, name: `symptom.${extension}`, type: mimeType },
        context,
      );

      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

      if (!result.transcribed) {
        setError('Não foi possível detectar fala. Tente novamente em um local mais silencioso.');
        return null;
      }

      return result.text;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao transcrever áudio';
      setError(msg);
      return null;
    } finally {
      setIsTranscribing(false);
      setDurationSeconds(0);

      // Restore audio mode
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
      } catch {}
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    setIsRecording(false);
    setIsTranscribing(false);
    setError(null);
    await cleanup();
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    isTranscribing,
    durationSeconds,
    error,
    startRecording,
    stopAndTranscribe,
    cancelRecording,
  };
}
