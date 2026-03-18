import React, { useEffect, useRef, useState, useMemo } from 'react';
import { nav } from '../lib/navigation';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useRequestsEvents } from '../contexts/RequestsEventsContext';
import { useAuth } from '../contexts/AuthContext';
import { useInvalidateRequests } from '../lib/hooks/useRequestsQuery';
import { useInvalidateDoctorRequests } from '../lib/hooks/useDoctorRequestsQuery';
import { showToast } from './ui/Toast';
import type { RequestUpdatedPayload } from '../lib/requestsEvents';
import { useAppTheme } from '../lib/ui/useAppTheme';

/** Normaliza status para comparação (in_consultation, InConsultation, etc.) */
function normalizeStatus(s: string | undefined): string {
  if (!s) return '';
  return s.toLowerCase().replace(/-/g, '_');
}

export function getMessageForUser(payload: RequestUpdatedPayload, isDoctor?: boolean): string {
  if (payload.message && payload.message.trim()) return payload.message.trim();
  const s = (payload.status || '').toLowerCase();
  const patientMap: Record<string, string> = {
    paid: 'Consulta pronta. Entre na sala de vídeo.',
    signed: 'Documento assinado. Baixe em Meus pedidos.',
    delivered: 'Documento recebido.',
    approved_pending_payment: 'Solicitação aprovada.',
    in_consultation: 'Médico na sala. Entre na chamada.',
    pending_post_consultation: 'Chamada encerrada. Os documentos serão disponibilizados em breve.',
    consultation_finished: 'Consulta encerrada.',
    cancelled: 'Pedido cancelado.',
    rejected: 'Pedido rejeitado.',
  };
  const doctorMap: Record<string, string> = {
    submitted: 'Nova solicitação na fila. Toque para ver.',
    paid: 'Solicitação aprovada.',
    signed: 'Documento assinado.',
    delivered: 'Documento recebido.',
    approved_pending_payment: 'Solicitação aprovada.',
    in_consultation: 'Paciente na sala.',
    pending_post_consultation: 'Chamada encerrada. Emita os documentos para finalizar a consulta.',
    consultation_finished: 'Consulta encerrada.',
    cancelled: 'Pedido cancelado.',
    rejected: 'Pedido rejeitado.',
  };
  const map = isDoctor ? doctorMap : patientMap;
  return map[s] || (isDoctor ? 'Solicitação atualizada.' : 'Seu pedido foi atualizado.');
}

const COUNTDOWN_SECONDS = 10;

/**
 * Escuta eventos RequestUpdated (SignalR): atualiza o banner na tela atual (pendingUpdate)
 * e mostra toast com "Ver pedido". Para paciente + in_consultation: mostra countdown e entra automaticamente.
 */
export function GlobalRequestUpdatedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const { subscribe, setPendingUpdate } = useRequestsEvents();
  const { user } = useAuth();
  const invalidateRequests = useInvalidateRequests();
  const invalidateDoctorRequests = useInvalidateDoctorRequests();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const routerRef = useRef(router);
  routerRef.current = router;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [countdownRequestId, setCountdownRequestId] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribe((payload: RequestUpdatedPayload) => {
      const isDoctor = user?.role === 'doctor';
      if (isDoctor) invalidateDoctorRequests();
      else invalidateRequests();
      const message = getMessageForUser(payload, isDoctor);
      const requestId = payload.requestId || '';

      // Paciente: quando médico inicia consulta (in_consultation), mostra popup com countdown e botão "Entrar agora"
      const statusNorm = normalizeStatus(payload.status);
      if (statusNorm === 'in_consultation' && !isDoctor && requestId) {
        const currentPath = pathnameRef.current ?? '';
        if (currentPath.includes(`/video/${requestId}`)) return; // já está na tela de vídeo
        setPendingUpdate(null);
        setCountdownRequestId(requestId);
        setCountdownSeconds(COUNTDOWN_SECONDS);
        return;
      }

      setPendingUpdate({ requestId, message });

      const path = requestId
        ? isDoctor
          ? `/doctor-request/${requestId}`
          : `/request-detail/${requestId}`
        : null;

      showToast({
        message,
        type: 'success',
        duration: 5000,
        ...(path
          ? {
              actionLabel: 'Ver pedido',
              onAction: () => {
                setPendingUpdate(null);
                nav.push(routerRef.current, path as any);
              },
            }
          : {}),
      });
    });
    return unsubscribe;
  }, [user, subscribe, setPendingUpdate, invalidateRequests, invalidateDoctorRequests]);

  // Countdown: decrementa a cada segundo e navega quando chegar em 0
  useEffect(() => {
    if (!countdownRequestId) return;
    setCountdownSeconds(COUNTDOWN_SECONDS);
    let remaining = COUNTDOWN_SECONDS;
    const t = setInterval(() => {
      remaining -= 1;
      setCountdownSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(t);
        const rid = countdownRequestId;
        setCountdownRequestId(null);
        nav.replace(routerRef.current, `/video/${rid}`);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [countdownRequestId]);

  const enterNow = () => {
    if (countdownRequestId) {
      const rid = countdownRequestId;
      setCountdownRequestId(null);
      nav.replace(routerRef.current, `/video/${rid}`);
    }
  };

  return countdownRequestId ? (
    <Modal visible transparent animationType="fade">
      <View style={styles.countdownOverlay}>
        <View style={styles.countdownCard}>
          <Text style={styles.countdownTitle}>Sua consulta vai começar em</Text>
          <Text style={styles.countdownNumber}>{countdownSeconds}</Text>
          <Text style={styles.countdownSub}>segundos</Text>
          <TouchableOpacity style={styles.enterNowBtn} onPress={enterNow} activeOpacity={0.8}>
            <Text style={styles.enterNowBtnText}>Entrar agora</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ) : null;
}

function makeStyles(colors: ReturnType<typeof import('../lib/designSystem').createTokens>['colors']) {
  return StyleSheet.create({
  countdownOverlay: {
    flex: 1,
    backgroundColor: colors.overlayBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    minWidth: 260,
  },
  countdownTitle: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  countdownNumber: {
    color: colors.success,
    fontSize: 64,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countdownSub: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  enterNowBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  enterNowBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  });
}
