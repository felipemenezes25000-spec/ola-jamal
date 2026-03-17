/**
 * useAudioRecorder — Captura áudio do microfone em chunks e envia para transcrição.
 *
 * Orchestrates:
 * - useAudioChunking: chunk sending + cycling logic
 * - Microphone permissions + audio mode
 * - Recording start/stop lifecycle
 * - Chunk interval + countdown timer
 * - Cleanup on unmount
 *
 * Fluxo: O PACIENTE grava (seu microfone). O médico fica mudo e só vê transcrição/anamnese ao vivo.
 *  1. Solicita permissão de microfone
 *  2. Grava áudio em chunks de 10s
 *  3. A cada chunk: para → lê arquivo → envia POST /api/consultation/transcribe
 *  4. Backend: Deepgram transcreve → SessionStore acumula → SignalR broadcast
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { useAudioChunking, CHUNK_DURATION_MS, RECORDING_OPTIONS } from './useAudioChunking';

interface UseAudioRecorderReturn {
  /** Whether audio is currently being recorded */
  isRecording: boolean;
  /** Number of chunks successfully sent to transcription */
  chunksSent: number;
  /** Number of chunks that failed to send */
  chunksFailed: number;
  /** Segundos até o próximo envio de chunk (0–10) */
  secondsUntilNextChunk: number;
  /** Last error message (permissão, gravação) */
  error: string | null;
  /** Último erro de envio (API/rede) */
  lastChunkError: string | null;
  /** Start recording and sending chunks */
  start: () => Promise<boolean>;
  /** Stop recording and send final chunk */
  stop: () => Promise<void>;
}

export function useAudioRecorder(requestId: string, stream: 'local' | 'remote' = 'local'): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);
  const chunkCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    chunksSent,
    chunksFailed,
    lastChunkError,
    secondsUntilNextChunk,
    setSecondsUntilNextChunk,
    sendChunk,
    cycleChunk,
    resetCounters,
  } = useAudioChunking(requestId);

  // ── Start recording ──

  const start = useCallback(async (): Promise<boolean> => {
    if (activeRef.current) return true;

    try {
      setError(null);
      resetCounters();

      // Request microphone permission
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        const msg = 'Permissão de microfone necessária para transcrição';
        setError(msg);
        Alert.alert('Permissão necessária', msg);
        return false;
      }

      // Configure audio mode for recording during call
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      activeRef.current = true;
      setIsRecording(true);

      // Start first recording
      try {
        const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
        recordingRef.current = recording;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'desconhecido';
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[AudioRecorder] First recording failed:', msg);
        }
        setError('Erro ao iniciar gravação: ' + msg);
        activeRef.current = false;
        setIsRecording(false);
        return false;
      }

      // Set up chunk cycle interval
      intervalRef.current = setInterval(
        () => cycleChunk(recordingRef, activeRef, stream),
        CHUNK_DURATION_MS,
      );

      // Countdown para próximo envio
      setSecondsUntilNextChunk(CHUNK_DURATION_MS / 1000);
      chunkCountdownRef.current = setInterval(() => {
        setSecondsUntilNextChunk((s) => (s <= 1 ? CHUNK_DURATION_MS / 1000 : s - 1));
      }, 1000);

      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[AudioRecorder] Started recording, chunk interval:', CHUNK_DURATION_MS);
      }
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao iniciar gravação';
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[AudioRecorder] Start error:', msg);
      }
      setError(msg);
      activeRef.current = false;
      setIsRecording(false);
      return false;
    }
  }, [cycleChunk, stream, resetCounters, setSecondsUntilNextChunk]);

  // ── Stop recording ──

  const stop = useCallback(async () => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[AudioRecorder] Stopping...');
    }
    activeRef.current = false;
    setIsRecording(false);
    setSecondsUntilNextChunk(0);

    // Clear intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (chunkCountdownRef.current) {
      clearInterval(chunkCountdownRef.current);
      chunkCountdownRef.current = null;
    }

    // Stop and send final chunk
    const finalRecording = recordingRef.current;
    if (finalRecording) {
      try {
        const status = await finalRecording.getStatusAsync();
        if (status.isRecording) {
          await finalRecording.stopAndUnloadAsync();
        }
        const uri = finalRecording.getURI();
        recordingRef.current = null;
        if (uri) {
          await sendChunk(uri, stream);
        }
      } catch (e: unknown) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[AudioRecorder] Final chunk error:', e instanceof Error ? e.message : e);
        }
      }
    }

    // Restore audio mode
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
    } catch {}

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[AudioRecorder] Stopped.');
    }
  }, [sendChunk, stream, setSecondsUntilNextChunk]);

  // ── Cleanup on unmount ──

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (chunkCountdownRef.current) {
        clearInterval(chunkCountdownRef.current);
        chunkCountdownRef.current = null;
      }
      const rec = recordingRef.current;
      if (rec) {
        rec.stopAndUnloadAsync().catch((e) => {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[AudioRecorder] stopAndUnload error:', e);
          }
        });
        recordingRef.current = null;
      }
    };
  }, []);

  return {
    isRecording,
    chunksSent,
    chunksFailed,
    secondsUntilNextChunk,
    error,
    lastChunkError,
    start,
    stop,
  };
}
