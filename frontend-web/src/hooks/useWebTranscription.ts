/**
 * useWebTranscription — Envia transcrição Daily.co para o backend no web.
 * Usa Daily React SDK (useTranscription) para acessar transcription-message.
 * Médico inicia transcrição ao entrar; envia chunks ao backend.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranscription, useLocalSessionId, useMeetingState } from '@daily-co/daily-react';
import { transcribeText } from '@/services/doctor-api-consultation';

interface UseWebTranscriptionOptions {
  requestId: string | null;
  /** Se a consulta já iniciou (status InConsultation/Paid) — backend só aceita envio quando true */
  consultationActive: boolean;
  /** Callback quando envio ao backend falha */
  onSendError?: (message: string) => void;
  /** Callback quando envio ao backend tem sucesso */
  onSendSuccess?: () => void;
}

export function useWebTranscription({
  requestId,
  consultationActive,
  onSendError,
  onSendSuccess,
}: UseWebTranscriptionOptions): void {
  const consultationActiveRef = useRef(consultationActive);
  const onSendErrorRef = useRef(onSendError);
  const onSendSuccessRef = useRef(onSendSuccess);
  const startedRef = useRef(false);

  useEffect(() => {
    consultationActiveRef.current = consultationActive;
    onSendErrorRef.current = onSendError;
    onSendSuccessRef.current = onSendSuccess;
  }, [consultationActive, onSendError, onSendSuccess]);

  // Reset startedRef when requestId changes so transcription can restart for a new session
  useEffect(() => {
    startedRef.current = false;
  }, [requestId]);

  const localSessionId = useLocalSessionId();
  const meetingState = useMeetingState();

  const sendToBackend = useCallback(
    async (text: string, speaker: 'medico' | 'paciente', startTimeSeconds?: number) => {
      if (!requestId || !text?.trim()) return;
      if (!consultationActiveRef.current) return;
      try {
        await transcribeText(requestId, text.trim(), speaker, startTimeSeconds);
        onSendSuccessRef.current?.();
      } catch (e: unknown) {
        const err = e as { message?: string };
        const msg = typeof err?.message === 'string' ? err.message : 'Erro ao enviar transcrição';
        onSendErrorRef.current?.(msg);
      }
    },
    [requestId]
  );

  const handleMessage = useCallback(
    (event: { text?: string; message?: { text?: string; start?: number; start_time?: number }; start?: number; start_time?: number; participantId?: string; participant_id?: string; session_id?: string; participant?: { session_id?: string } }) => {
      const text = event?.text ?? event?.message?.text ?? '';
      if (!text?.trim()) return;

      const msg = event?.message as { start?: number; start_time?: number } | undefined;
      const startTimeSeconds =
        event?.start ??
        event?.start_time ??
        msg?.start ??
        msg?.start_time;

      const eventParticipantId =
        event?.participantId ??
        event?.participant_id ??
        event?.session_id ??
        event?.participant?.session_id ??
        '';

      const resolvedLocalId = localSessionId ?? null;
      if (!resolvedLocalId || !eventParticipantId) return;

      const isLocal = eventParticipantId === resolvedLocalId;
      const speaker: 'medico' | 'paciente' = isLocal ? 'medico' : 'paciente';
      void sendToBackend(text, speaker, typeof startTimeSeconds === 'number' ? startTimeSeconds : undefined);
    },
    [localSessionId, sendToBackend]
  );

  const { startTranscription } = useTranscription({
    onTranscriptionMessage: handleMessage,
  });

  useEffect(() => {
    if (meetingState === 'joined-meeting' && !startedRef.current && requestId) {
      startedRef.current = true;
      try {
        startTranscription?.({ language: 'pt-BR' });
      } catch {
        startedRef.current = false;
      }
    }
  }, [meetingState, requestId, startTranscription]);
}
