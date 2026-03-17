/**
 * useAudioChunking — Manages audio chunk transcription and cycling.
 *
 * Handles:
 * - sendChunk: sends recorded audio file to transcription API + cleanup
 * - cycleChunk: stops current recording, starts new one, sends previous async
 * - Chunk counters (sent, failed) and error state
 *
 * Used by useAudioRecorder as the chunking engine.
 */

import { useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { transcribeAudioChunk } from '../lib/api';

const CHUNK_DURATION_MS = 15_000; // 15 seconds per chunk (menos fronteiras cortadas)

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

export { CHUNK_DURATION_MS, RECORDING_OPTIONS };

export interface AudioChunkingReturn {
  chunksSent: number;
  chunksFailed: number;
  lastChunkError: string | null;
  secondsUntilNextChunk: number;
  setSecondsUntilNextChunk: React.Dispatch<React.SetStateAction<number>>;
  /** Send a recorded audio file to the transcription API */
  sendChunk: (uri: string, stream: 'local' | 'remote') => Promise<void>;
  /** Stop current recording, start new, send previous async */
  cycleChunk: (
    recordingRef: React.MutableRefObject<Audio.Recording | null>,
    activeRef: React.MutableRefObject<boolean>,
    stream: 'local' | 'remote',
  ) => Promise<void>;
  /** Reset counters for new session */
  resetCounters: () => void;
}

export function useAudioChunking(requestId: string): AudioChunkingReturn {
  const [chunksSent, setChunksSent] = useState(0);
  const [chunksFailed, setChunksFailed] = useState(0);
  const [lastChunkError, setLastChunkError] = useState<string | null>(null);
  const [secondsUntilNextChunk, setSecondsUntilNextChunk] = useState(0);
  const chunkIndexRef = useRef(0);

  // ── Send a recorded chunk to the transcription API ──

  const sendChunk = useCallback(
    async (uri: string, stream: 'local' | 'remote') => {
      try {
        // Check file exists and has content
        const fileInfo = await FileSystem.getInfoAsync(uri);
        const fileSize = fileInfo.exists ? ((fileInfo as unknown as { size?: number }).size ?? 0) : 0;
        if (!fileInfo.exists || (fileSize ?? 0) < 500) {
          if (__DEV__) {
            console.warn(`[AudioChunking] Chunk ignorado: arquivo muito pequeno (${fileSize ?? 0} bytes).`);
          }
          return;
        }

        const extension = Platform.OS === 'web' ? 'webm' : 'm4a';
        const mimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
        const fileName = `chunk_${chunkIndexRef.current}.${extension}`;
        chunkIndexRef.current++;

        const fileObject = {
          uri,
          name: fileName,
          type: mimeType,
        };

        await transcribeAudioChunk(requestId, fileObject as any, stream, { fileSize });
        setChunksSent((c) => c + 1);
        setLastChunkError(null);
        setSecondsUntilNextChunk(CHUNK_DURATION_MS / 1000);
        if (__DEV__) {
          console.warn(`[AudioChunking] Chunk enviado OK (total: ${chunkIndexRef.current})`);
        }
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        const status = e?.status;
        const display = status != null ? `[${status}] ${msg}` : msg;
        if (__DEV__) console.warn(`[AudioChunking] Chunk send failed:`, display);
        setLastChunkError(display);
        setChunksFailed((c) => c + 1);
      } finally {
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {}
      }
    },
    [requestId],
  );

  // ── Record one chunk, stop previous, send it, start new ──

  const cycleChunk = useCallback(async (
    recordingRef: React.MutableRefObject<Audio.Recording | null>,
    activeRef: React.MutableRefObject<boolean>,
    stream: 'local' | 'remote',
  ) => {
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
        if (__DEV__) console.warn('[AudioChunking] Stop chunk error:', e?.message);
      }
      recordingRef.current = null;
    }

    // 2. Start new recording immediately (minimize gap)
    if (activeRef.current) {
      try {
        const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
        recordingRef.current = recording;
      } catch (e: unknown) {
        if (__DEV__) console.warn('[AudioChunking] Start new chunk error:', e instanceof Error ? e.message : e);
      }
    }

    // 3. Send previous chunk in background (don't block next recording)
    if (prevUri) {
      sendChunk(prevUri, stream).catch((e) => { if (__DEV__) console.warn('[AudioChunking] sendChunk failed:', e); });
    }
  }, [sendChunk]);

  const resetCounters = useCallback(() => {
    setChunksSent(0);
    setChunksFailed(0);
    setLastChunkError(null);
    setSecondsUntilNextChunk(0);
    chunkIndexRef.current = 0;
  }, []);

  return {
    chunksSent,
    chunksFailed,
    lastChunkError,
    secondsUntilNextChunk,
    setSecondsUntilNextChunk,
    sendChunk,
    cycleChunk,
    resetCounters,
  };
}
