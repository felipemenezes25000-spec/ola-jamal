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
}

export function useDailyTranscription({
  callRef,
  requestId,
  isDoctor,
  localSessionId,
  callJoined,
  consultationActive,
  onSendError,
}: UseDailyTranscriptionOptions): { isTranscribing: boolean } {
  const startedRef = useRef(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const consultationActiveRef = useRef(consultationActive);
  const onSendErrorRef = useRef(onSendError);
  consultationActiveRef.current = consultationActive;
  onSendErrorRef.current = onSendError;

  const sendToBackend = useCallback(
    async (text: string, speaker: 'medico' | 'paciente') => {
      if (!requestId || !text?.trim()) return;
      if (!consultationActiveRef.current) return; // Backend rejeita se status não for InConsultation/Paid
      try {
        await transcribeTextChunk(requestId, text.trim(), speaker);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro ao enviar transcrição';
        if (__DEV__) console.warn('[DailyTranscription] Erro ao enviar:', e);
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

    const handleMessage = (event: any) => {
      const text = event?.text ?? event?.message?.text ?? '';
      if (!text?.trim()) return;

      const participantId = event?.participantId ?? event?.participant_id ?? '';
      const isLocal = participantId === localSessionId;

      const speaker: 'medico' | 'paciente' = isDoctor
        ? (isLocal ? 'medico' : 'paciente')
        : (isLocal ? 'paciente' : 'medico');

      if (isDoctor) sendToBackend(text, speaker);
    };

    const startTranscription = async () => {
      if (startedRef.current) return;
      try {
        await call.startTranscription?.({ language: 'pt-BR' });
        startedRef.current = true;
        setIsTranscribing(true);
        if (__DEV__) console.log('[DailyTranscription] Transcrição iniciada');
      } catch (e) {
        if (__DEV__) console.warn('[DailyTranscription] Falha ao iniciar:', e);
      }
    };

    const handleStarted = () => setIsTranscribing(true);
    const handleStopped = () => {
      setIsTranscribing(false);
      startedRef.current = false;
    };

    if (isDoctor && callJoined) {
      startTranscription();
    }

    call.on?.('transcription-message' as any, handleMessage);
    call.on?.('transcription-started' as any, handleStarted);
    call.on?.('transcription-stopped' as any, handleStopped);

    return () => {
      call.off?.('transcription-message' as any, handleMessage);
      call.off?.('transcription-started' as any, handleStarted);
      call.off?.('transcription-stopped' as any, handleStopped);
    };
  }, [
    callRef,
    requestId,
    isDoctor,
    localSessionId,
    callJoined,
    sendToBackend,
  ]);

  return { isTranscribing };
}
