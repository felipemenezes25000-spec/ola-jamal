/**
 * useAudioRecorder — Captura áudio do microfone em chunks e envia para transcrição.
 *
 * Fluxo:
 *  1. Solicita permissão de microfone
 *  2. Grava áudio em chunks de CHUNK_DURATION_MS (10s)
 *  3. A cada chunk: para → lê arquivo → envia POST /api/consultation/transcribe
 *  4. Backend: Whisper transcreve → SessionStore acumula → SignalR broadcast
 *  5. Frontend: SignalR listener atualiza painel de transcrição/anamnese
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
  /** Last error message */
  error: string | null;
  /** Start recording and sending chunks */
  start: () => Promise<boolean>;
  /** Stop recording and send final chunk */
  stop: () => Promise<void>;
}

export function useAudioRecorder(requestId: string): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [chunksSent, setChunksSent] = useState(0);
  const [chunksFailed, setChunksFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
        if (!fileInfo.exists || (fileInfo.size ?? 0) < 500) {
          // Chunk too small (silence or error) — skip
          return;
        }

        const extension = Platform.OS === 'web' ? 'webm' : 'm4a';
        const mimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
        const fileName = `chunk_${chunkIndexRef.current}.${extension}`;
        chunkIndexRef.current++;

        // React Native FormData accepts { uri, name, type } objects for file uploads
        // This is the standard way to upload files in RN — no Blob conversion needed
        const fileObject = {
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          name: fileName,
          type: mimeType,
        };

        await transcribeAudioChunk(requestId, fileObject as any, stream);
        setChunksSent((c) => c + 1);
      } catch (e: any) {
        console.warn(`[AudioRecorder] Chunk send failed: ${e?.message}`);
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
      sendChunk(prevUri, 'local').catch(() => {});
    }
  }, [sendChunk]);

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

      // Configure audio mode for recording during call
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
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
          await sendChunk(uri, 'local');
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
  }, [sendChunk]);

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
    start,
    stop,
  };
}
