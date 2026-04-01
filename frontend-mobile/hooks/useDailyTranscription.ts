/**
 * useDailyTranscription — Usa transcrição nativa do Daily.co (ambos os participantes).
 * O médico inicia a transcrição; eventos transcription-message chegam com texto e speaker.
 * Apenas o médico envia ao backend (evita duplicatas).
 *
 * Mitigação ponto 3: inicia transcrição assim que médico entra na chamada (callJoined),
 * sem esperar consultationActive. Envia ao backend só quando consultationActive (status InConsultation/Paid).
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { MutableRefObject } from 'react';
import type { DailyCall } from '@daily-co/react-native-daily-js';
import { transcribeTextChunk } from '../lib/api';

// Tipo local: o SDK Daily.co não exporta tipos para eventos de transcrição
interface DailyTranscriptionMessageEvent {
  text?: string;
  message?: { text?: string; start?: number; start_time?: number };
  start?: number;
  start_time?: number;
  participantId?: string;
  participant_id?: string;
  session_id?: string;
  participant?: { session_id?: string };
}

interface UseDailyTranscriptionOptions {
  /** Ref do DailyCall (de useDailyCall) */
  callRef: MutableRefObject<DailyCall | null>;
  /** ID do request da consulta */
  requestId: string | null;
  /** Se o usuário local é o médico */
  isDoctor: boolean;
  /** session_id do participante local (para mapear speaker) */
  localSessionId: string | null;
  /** Se o médico já está na chamada (callState === 'joined') — inicia transcrição cedo para não perder áudio */
  callJoined: boolean;
  /** Se a consulta já iniciou (status InConsultation/Paid) — backend só aceita envio quando true */
  consultationActive: boolean;
  /** Callback quando envio ao backend falha (Ponto 5: feedback de erro) */
  onSendError?: (message: string) => void;
  /** Callback quando envio ao backend tem sucesso (limpa erro anterior) */
  onSendSuccess?: () => void;
  /** Callback quando Deepgram falha — ativa fallback Whisper (gravação local → POST transcribe) */
  onTranscriptionFailed?: () => void;
}

export function useDailyTranscription({
  callRef,
  requestId,
  isDoctor,
  localSessionId,
  callJoined,
  consultationActive,
  onSendError,
  onSendSuccess,
  onTranscriptionFailed,
}: UseDailyTranscriptionOptions): { isTranscribing: boolean; error: string | null; stop: () => Promise<void> } {
  const startedRef = useRef(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consultationActiveRef = useRef(consultationActive);
  const localSessionIdRef = useRef(localSessionId);
  const onSendErrorRef = useRef(onSendError);
  const onSendSuccessRef = useRef(onSendSuccess);
  const onTranscriptionFailedRef = useRef(onTranscriptionFailed);
  consultationActiveRef.current = consultationActive;
  localSessionIdRef.current = localSessionId;
  onSendErrorRef.current = onSendError;
  onSendSuccessRef.current = onSendSuccess;
  onTranscriptionFailedRef.current = onTranscriptionFailed;

  const sendToBackend = useCallback(
    async (text: string, speaker: 'medico' | 'paciente', startTimeSeconds?: number) => {
      if (!requestId || !text?.trim()) return;
      if (!consultationActiveRef.current) return; // Backend rejeita se status não for InConsultation/Paid
      try {
        await transcribeTextChunk(requestId, text.trim(), speaker, startTimeSeconds);
        setError(null);
        onSendSuccessRef.current?.();
      } catch (e: unknown) {
        const err = e as { message?: string };
        const msg = typeof err?.message === 'string' ? err.message : 'Erro ao enviar transcrição';
        if (__DEV__) console.warn('[DailyTranscription] Erro ao enviar:', e);
        setError(msg);
        onSendErrorRef.current?.(msg);
      }
    },
    [requestId]
  );

  useEffect(() => {
    const call = callRef.current;
    if (!call || !requestId) return;
    // Médico: precisa estar na chamada. Paciente: só escuta eventos.
    if (isDoctor && !callJoined) return;

    const handleMessage = (event: DailyTranscriptionMessageEvent) => {
      const text = event?.text ?? event?.message?.text ?? '';
      if (!text?.trim()) return;

      // Deepgram/Daily: start (segundos desde início da transcrição), start_time, ou message.start
      const startTimeSeconds =
        event?.start ??
        event?.start_time ??
        event?.message?.start ??
        event?.message?.start_time;

      // Daily.co pode usar participantId, participant_id, session_id ou participant.session_id
      const eventParticipantId =
        event?.participantId ??
        event?.participant_id ??
        event?.session_id ??
        event?.participant?.session_id ??
        '';

      // Resolve local session_id: prioridade call.participants() (sempre atual) > prop
      const participants = call.participants?.();
      const resolvedLocalId =
        participants?.local?.session_id ?? localSessionIdRef.current ?? null;

      if (!resolvedLocalId) {
        if (__DEV__) console.warn('[DailyTranscription] localSessionId ainda não disponível — ignorando chunk');
        return;
      }

      // Sem participantId no evento, não dá para saber quem falou — não enviar (evita misturar)
      if (!eventParticipantId) {
        if (__DEV__) console.warn('[DailyTranscription] Evento sem participantId — ignorando chunk');
        return;
      }

      const isLocal = eventParticipantId === resolvedLocalId;

      const speaker: 'medico' | 'paciente' = isDoctor
        ? (isLocal ? 'medico' : 'paciente')
        : (isLocal ? 'paciente' : 'medico');

      if (isDoctor) sendToBackend(text, speaker, typeof startTimeSeconds === 'number' ? startTimeSeconds : undefined);
    };

    const startTranscription = async () => {
      if (startedRef.current) return;
      try {
        await call.startTranscription?.({ language: 'pt-BR' });
        startedRef.current = true;
        setIsTranscribing(true);
        if (__DEV__) console.warn('[DailyTranscription] Transcrição iniciada');
      } catch (e) {
        if (__DEV__) console.warn('[DailyTranscription] Falha ao iniciar Deepgram:', e);
        onTranscriptionFailedRef.current?.();
      }
    };

    const handleStarted = () => setIsTranscribing(true);
    const handleStopped = () => {
      setIsTranscribing(false);
      startedRef.current = false;
    };
    const handleError = () => {
      if (__DEV__) console.warn('[DailyTranscription] transcription-error — Deepgram falhou, ativando fallback Whisper');
      setIsTranscribing(false);
      startedRef.current = false;
      onTranscriptionFailedRef.current?.();
    };

    if (isDoctor && callJoined) {
      startTranscription();
    }

    // Daily.co transcription events — tipos do pacote podem estar desatualizados
    const evMsg = 'transcription-message' as string;
    const evStarted = 'transcription-started' as string;
    const evStopped = 'transcription-stopped' as string;
    const evError = 'transcription-error' as string;
    call.on?.(evMsg, handleMessage);
    call.on?.(evStarted, handleStarted);
    call.on?.(evStopped, handleStopped);
    call.on?.(evError, handleError);

    return () => {
      call.off?.(evMsg, handleMessage);
      call.off?.(evStarted, handleStarted);
      call.off?.(evStopped, handleStopped);
      call.off?.(evError, handleError);
    };
  }, [
    callRef,
    requestId,
    isDoctor,
    callJoined,
    sendToBackend,
  ]);

  const stop = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    try {
      await (call as { stopTranscription?: () => Promise<void> }).stopTranscription?.();
    } catch (e) {
      if (__DEV__) console.warn('[DailyTranscription] stop failed:', e);
    }
    startedRef.current = false;
    setIsTranscribing(false);
  }, [callRef]);

  return { isTranscribing, error, stop };
}
