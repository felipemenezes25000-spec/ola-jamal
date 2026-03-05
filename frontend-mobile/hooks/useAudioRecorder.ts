/**
 * useAudioRecorder — Captura áudio do microfone em chunks e envia para transcrição.
 *
 * Fluxo: O PACIENTE grava (seu microfone). O médico fica mudo e só vê transcrição/anamnese ao vivo.
 *  1. Solicita permissão de microfone
 *  2. Grava áudio em chunks de CHUNK_DURATION_MS (10s)
 *  3. A cada chunk: para → lê arquivo → envia POST /api/consultation/transcribe (stream: remote)
 *  4. Backend: Deepgram transcreve → SessionStore acumula → SignalR broadcast
 *  5. Médico: SignalR listener atualiza painel de transcrição/anamnese
 *
 * Compatível com teleconsulta (Daily.co) e consulta presencial.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { transcribeAudioChunk } from '../lib/api';

const CHUNK_DURATION_MS = 10_000; // 10 segundos por chunk

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: 2, // MPEG_4
    audioEncoder: 3, // AAC
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: 0x40, // MEDIUM
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    outputFormat: undefined, // Let iOS choose best AAC format
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

interface UseAudioRecorderReturn {
  /** Whether audio is currently being recorded */
  isRecording: boolean;
  /** Number of chunks successfully sent to transcription */
  chunksSent: number;
  /** Number of chunks that failed to send */
  chunksFailed: number;
  /** Last error message (permissão, gravação) */
  error: string | null;
  /** Último erro de envio (API/rede) — útil quando chunksFailed > 0 */
  lastChunkError: string | null;
  /** Start recording and sending chunks */
  start: () => Promise<boolean>;
  /** Stop recording and send final chunk */
  stop: () => Promise<void>;
}

export function useAudioRecorder(requestId: string, stream: 'local' | 'remote' = 'local'): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [chunksSent, setChunksSent] = useState(0);
  const [chunksFailed, setChunksFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastChunkError, setLastChunkError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);
  const chunkIndexRef = useRef(0);

  // ── Send a recorded chunk to the transcription API ──

  const sendChunk = useCallback(
    async (uri: string, stream: 'local' | 'remote' = 'local') => {
      try {
        // Check file exists and has content
        const fileInfo = await FileSystem.getInfoAsync(uri);
        const fileSize = fileInfo.exists ? ((fileInfo as unknown as { size?: number }).size ?? 0) : 0;
        if (!fileInfo.exists || (fileSize ?? 0) < 500) {
          if (__DEV__) {
            console.warn(`[AudioRecorder] Chunk ignorado: arquivo muito pequeno (${fileSize ?? 0} bytes). Fale durante a gravação.`);
          }
          return;
        }

        const extension = Platform.OS === 'web' ? 'webm' : 'm4a';
        const mimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
        const fileName = `chunk_${chunkIndexRef.current}.${extension}`;
        chunkIndexRef.current++;

        // React Native FormData accepts { uri, name, type } — use URI as-is (expo-av) on both platforms
        const fileObject = {
          uri,
          name: fileName,
          type: mimeType,
        };

        await transcribeAudioChunk(requestId, fileObject as any, stream);
        setChunksSent((c) => c + 1);
        setLastChunkError(null);
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        const status = e?.status;
        const display = status != null ? `[${status}] ${msg}` : msg;
        console.warn(`[AudioRecorder] Chunk send failed:`, display);
        setLastChunkError(display);
        setChunksFailed((c) => c + 1);
        // Don't stop recording on individual chunk failure
      } finally {
        // Clean up temp file
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {}
      }
    },
    [requestId],
  );

  // ── Record one chunk, stop previous, send it, start new ──

  const cycleChunk = useCallback(async () => {
    if (!activeRef.current) return;

    // 1. Stop current recording and get URI
    const prevRecording = recordingRef.current;
    let prevUri: string | null = null;

    if (prevRecording) {
      try {
        const status = await prevRecording.getStatusAsync();
        if (status.isRecording) {
          await prevRecording.stopAndUnloadAsync();
        }
        prevUri = prevRecording.getURI();
      } catch (e: any) {
        console.warn('[AudioRecorder] Stop chunk error:', e?.message);
      }
      recordingRef.current = null;
    }

    // 2. Start new recording immediately (minimize gap)
    if (activeRef.current) {
      try {
        const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
        recordingRef.current = recording;
      } catch (e: any) {
        console.warn('[AudioRecorder] Start new chunk error:', e?.message);
        // Try again on next cycle
      }
    }

    // 3. Send previous chunk in background (don't block next recording)
    if (prevUri) {
      sendChunk(prevUri, stream).catch(() => {});
    }
  }, [sendChunk, stream]);

  // ── Start recording ──

  const start = useCallback(async (): Promise<boolean> => {
    if (activeRef.current) return true; // Already recording

    try {
      setError(null);
      setChunksSent(0);
      setChunksFailed(0);
      chunkIndexRef.current = 0;

      // Request microphone permission
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        const msg = 'Permissão de microfone necessária para transcrição';
        setError(msg);
        Alert.alert('Permissão necessária', msg);
        return false;
      }

      // Configure audio mode for recording during call (DuckOthers allows recording alongside Daily.co)
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
      } catch (e: any) {
        console.warn('[AudioRecorder] First recording failed:', e?.message);
        setError('Erro ao iniciar gravação: ' + (e?.message || 'desconhecido'));
        activeRef.current = false;
        setIsRecording(false);
        return false;
      }

      // Set up chunk cycle interval
      intervalRef.current = setInterval(cycleChunk, CHUNK_DURATION_MS);

      console.log('[AudioRecorder] Started recording, chunk interval:', CHUNK_DURATION_MS);
      return true;
    } catch (e: any) {
      const msg = e?.message || 'Erro ao iniciar gravação';
      console.warn('[AudioRecorder] Start error:', msg);
      setError(msg);
      activeRef.current = false;
      setIsRecording(false);
      return false;
    }
  }, [cycleChunk]);

  // ── Stop recording ──

  const stop = useCallback(async () => {
    console.log('[AudioRecorder] Stopping...');
    activeRef.current = false;
    setIsRecording(false);

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
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
          // Send final chunk synchronously (we're ending the session)
          await sendChunk(uri, stream);
        }
      } catch (e: any) {
        console.warn('[AudioRecorder] Final chunk error:', e?.message);
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

    console.log(
      `[AudioRecorder] Stopped. Sent: ${chunkIndexRef.current} chunks`,
    );
  }, [sendChunk, stream]);

  // ── Cleanup on unmount ──

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const rec = recordingRef.current;
      if (rec) {
        rec.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  return {
    isRecording,
    chunksSent,
    chunksFailed,
    error,
    lastChunkError,
    start,
    stop,
  };
}
