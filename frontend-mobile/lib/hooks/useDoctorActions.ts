/**
 * useDoctorActions — Doctor action mutations using React Query.
 *
 * Replaces manual useState(actionLoading) + try/catch with useMutation.
 * Benefits:
 * - Built-in isPending (replaces actionLoading)
 * - Automatic cache invalidation on success
 * - Consistent error handling
 * - No stale closure bugs
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  approveRequest,
  rejectRequest,
  signRequest,
  acceptConsultation,
  validatePrescription,
} from '../api';
import type { RequestResponseDto } from '../../types/database';
import { showToast } from '../../components/ui/Toast';
import { getApiErrorMessage } from '../api-client';
import { requestDetailKeys } from './useRequestDetailQuery';
import { REQUESTS_QUERY_KEY } from './useRequestsQuery';
import { DOCTOR_REQUESTS_QUERY_KEY } from './useDoctorRequestsQuery';

interface UseDoctorActionsOptions {
  requestId: string;
  request: RequestResponseDto | null;
  onRejectSuccess?: () => void;
  onSignSuccess?: () => void;
  onSignError?: () => void;
}

export function useDoctorActions({
  requestId,
  request,
  onRejectSuccess,
  onSignSuccess,
  onSignError,
}: UseDoctorActionsOptions) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: requestDetailKeys.detail(requestId) });
    queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: DOCTOR_REQUESTS_QUERY_KEY });
  };

  // ── Approve ─────────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: () => approveRequest(requestId),
    onSuccess: () => {
      invalidateAll();
      showToast({ message: 'Solicitação aprovada com sucesso!', type: 'success' });
    },
    onError: (e: unknown) => {
      showToast({ message: (e as Error)?.message || 'Falha ao aprovar.', type: 'error' });
    },
  });

  const handleApprove = () => {
    if (!requestId) return;
    if (Platform.OS === 'web') {
      if (window.confirm('Confirma a aprovação?')) approveMutation.mutate();
    } else {
      Alert.alert('Aprovar', 'Confirma a aprovação?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprovar', onPress: () => approveMutation.mutate() },
      ]);
    }
  };

  // ── Reject ──────────────────────────────────────────────────

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectRequest(requestId, reason),
    onSuccess: () => {
      invalidateAll();
      onRejectSuccess?.();
      showToast({ message: 'Pedido rejeitado.', type: 'info' });
    },
    onError: (e: unknown) => {
      showToast({ message: (e as Error)?.message || 'Falha ao rejeitar.', type: 'error' });
    },
  });

  const handleReject = (rejectionReason: string) => {
    if (!rejectionReason.trim()) {
      showToast({ message: 'Informe o motivo da rejeição.', type: 'warning' });
      return;
    }
    if (!requestId) return;
    rejectMutation.mutate(rejectionReason.trim());
  };

  // ── Sign ────────────────────────────────────────────────────

  const signMutation = useMutation({
    mutationFn: async (certPassword: string) => {
      // Pre-validate before signing
      const validation = await validatePrescription(requestId);
      if (!validation.valid) {
        // Throw structured error for onError to handle
        throw { _validationError: true, ...validation };
      }
      return signRequest(requestId, { pfxPassword: certPassword });
    },
    onSuccess: () => {
      invalidateAll();
      onSignSuccess?.();
      showToast({ message: 'Documento assinado digitalmente!', type: 'success' });
    },
    onError: (e: unknown) => {
      onSignError?.();
      const err = e as any;

      // Validation error (from pre-check or backend 400)
      if (err?._validationError || err?.missingFields?.length || err?.messages?.length) {
        const checklist = (err?.messages ?? [err?.message ?? 'Erro']).join('\n• ');
        const needsDoctorProfile = (err?.missingFields ?? []).some(
          (f: string) => f.includes('médico.endereço') || f.includes('médico.telefone')
        );
        Alert.alert(
          'Receita incompleta',
          needsDoctorProfile
            ? `Para assinar, preencha endereço e telefone profissional no seu perfil de médico.\n\n• ${checklist}`
            : `Verifique os campos obrigatórios:\n\n• ${checklist}`,
          needsDoctorProfile
            ? [
                { text: 'IR AO MEU PERFIL', onPress: () => router.push('/(doctor)/profile' as never) },
                { text: 'OK', style: 'cancel' },
              ]
            : [{ text: 'OK' }]
        );
        return;
      }

      // Generic error (wrong password etc.)
      const message = getApiErrorMessage(e) || 'Senha incorreta ou erro na assinatura.';
      showToast({ message, type: 'error' });
    },
  });

  const handleSign = (certPassword: string) => {
    if (!certPassword.trim()) {
      showToast({ message: 'Digite a senha do certificado.', type: 'warning' });
      return;
    }
    if (!requestId || !request) return;
    signMutation.mutate(certPassword);
  };

  // ── Accept Consultation ─────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: () => acceptConsultation(requestId),
    onSuccess: () => {
      invalidateAll();
      showToast({ message: 'Consulta aceita!', type: 'success' });
    },
    onError: (e: unknown) => {
      showToast({ message: (e as Error)?.message || 'Falha ao aceitar.', type: 'error' });
    },
  });

  const handleAcceptConsultation = () => {
    if (!requestId) return;
    acceptMutation.mutate();
  };

  // ── Combined loading state ──────────────────────────────────

  const actionLoading =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    signMutation.isPending ||
    acceptMutation.isPending;

  return {
    actionLoading,
    handleApprove,
    handleReject,
    handleSign,
    handleAcceptConsultation,

    // Expose individual mutations for advanced usage
    approveMutation,
    rejectMutation,
    signMutation,
    acceptMutation,
  };
}
