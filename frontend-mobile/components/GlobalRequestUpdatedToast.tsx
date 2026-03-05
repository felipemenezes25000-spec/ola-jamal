import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useRequestsEvents } from '../contexts/RequestsEventsContext';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from './ui/Toast';
import type { RequestUpdatedPayload } from '../lib/requestsEvents';

export function getMessageForUser(payload: RequestUpdatedPayload): string {
  if (payload.message && payload.message.trim()) return payload.message.trim();
  const s = (payload.status || '').toLowerCase();
  const map: Record<string, string> = {
    paid: 'Pagamento confirmado.',
    signed: 'Documento assinado. Baixe em Meus pedidos.',
    delivered: 'Documento recebido.',
    approved_pending_payment: 'Solicitação aprovada. Realize o pagamento.',
    consultation_ready: 'Consulta pronta. Entre na sala de vídeo.', // legado: novo fluxo usa paid
    in_consultation: 'Médico na sala. Entre na chamada.',
    consultation_finished: 'Consulta encerrada.',
    cancelled: 'Pedido cancelado.',
    rejected: 'Pedido rejeitado.',
  };
  return map[s] || 'Seu pedido foi atualizado.';
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
  const routerRef = useRef(router);
  routerRef.current = router;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [countdownRequestId, setCountdownRequestId] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribe((payload: RequestUpdatedPayload) => {
      const message = getMessageForUser(payload);
      const requestId = payload.requestId || '';
      const isDoctor = user?.role === 'doctor';

      // Paciente: quando médico inicia consulta (in_consultation), mostra countdown e entra automaticamente
      if (payload.status === 'in_consultation' && !isDoctor && requestId) {
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
                routerRef.current.push(path as any);
              },
            }
          : {}),
      });
    });
    return unsubscribe;
  }, [user, subscribe, setPendingUpdate]);

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
        routerRef.current.push(`/video/${rid}` as any);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [countdownRequestId]);

  return countdownRequestId ? (
    <Modal visible transparent animationType="fade">
      <View style={styles.countdownOverlay}>
        <View style={styles.countdownCard}>
          <Text style={styles.countdownTitle}>Sua consulta vai começar em</Text>
          <Text style={styles.countdownNumber}>{countdownSeconds}</Text>
          <Text style={styles.countdownSub}>segundos</Text>
        </View>
      </View>
    </Modal>
  ) : null;
}

const styles = StyleSheet.create({
  countdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    minWidth: 260,
  },
  countdownTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  countdownNumber: {
    color: '#22c55e',
    fontSize: 64,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countdownSub: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
});
