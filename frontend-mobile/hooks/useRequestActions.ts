/**
 * useRequestActions — Doctor action handlers for medical requests.
 *
 * Handles: approve, reject, sign (with ICP-Brasil validation), accept consultation.
 * Manages actionLoading state internally.
 *
 * The parent hook provides current form values and callbacks for state resets.
 */

import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  approveRequest,
  rejectRequest,
  signRequest,
  acceptConsultation,
  validatePrescription,
} from '../lib/api';
import type { RequestResponseDto } from '../types/database';
import { showToast } from '../components/ui/Toast';
import { getApiErrorMessage } from '../lib/api-client';

interface UseRequestActionsOptions {
  requestId: string;
  request: RequestResponseDto | null;
  rejectionReason: string;
  certPassword: string;
  loadData: () => Promise<void>;
  onRejectSuccess: () => void;
  onSignSuccess: () => void;
  onSignError: () => void;
}

export interface UseRequestActionsReturn {
  actionLoading: boolean;
  handleApprove: () => void;
  handleReject: () => Promise<void>;
  handleSign: () => Promise<void>;
  handleAcceptConsultation: () => Promise<void>;
}

export function useRequestActions({
  requestId,
  request,
  rejectionReason,
  certPassword,
  loadData,
  onRejectSuccess,
  onSignSuccess,
  onSignError,
}: UseRequestActionsOptions): UseRequestActionsReturn {
  const [actionLoading, setActionLoading] = useState(false);
  const router = useRouter();

  const executeApprove = useCallback(async () => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      await approveRequest(requestId);
      await loadData();
      showToast({ message: 'Solicitação aprovada com sucesso!', type: 'success' });
    } catch (e: unknown) {
      showToast({ message: (e as Error)?.message || 'Falha ao aprovar.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }, [requestId, loadData]);

  const handleApprove = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('Confirma a aprovação?')) executeApprove();
    } else {
      Alert.alert('Aprovar', 'Confirma a aprovação?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprovar', onPress: executeApprove },
      ]);
    }
  }, [executeApprove]);

  const handleReject = useCallback(async () => {
    if (!rejectionReason.trim()) {
      showToast({ message: 'Informe o motivo da rejeição.', type: 'warning' });
      return;
    }
    if (!requestId) return;
    setActionLoading(true);
    try {
      await rejectRequest(requestId, rejectionReason.trim());
      loadData();
      onRejectSuccess();
      showToast({ message: 'Pedido rejeitado.', type: 'info' });
    } catch (e: unknown) {
      showToast({ message: (e as Error)?.message || 'Falha ao rejeitar.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }, [requestId, rejectionReason, loadData, onRejectSuccess]);

  const handleSign = useCallback(async () => {
    if (!certPassword.trim()) {
      showToast({ message: 'Digite a senha do certificado.', type: 'warning' });
      return;
    }
    if (!requestId || !request) return;
    setActionLoading(true);
    try {
      const validation = await validatePrescription(requestId);
      if (!validation.valid) {
        const needsPatientProfile = (validation.missingFields ?? []).some(
          (f) =>
            f.includes('paciente.sexo') ||
            f.includes('paciente.data_nascimento') ||
            f.includes('paciente.endereço')
        );
        const needsDoctorProfile = (validation.missingFields ?? []).some(
          (f) => f.includes('médico.endereço') || f.includes('médico.telefone')
        );
        const checklist = (validation.messages ?? []).join('\n• ');
        const action = needsPatientProfile
          ? 'O paciente precisa completar sexo, data de nascimento ou endereço no perfil.'
          : needsDoctorProfile
            ? 'Para assinar, é obrigatório preencher endereço e telefone profissional no seu perfil de médico.'
            : 'Corrija os campos indicados antes de assinar.';

        Alert.alert(
          'Receita incompleta',
          `${action}\n\n• ${checklist}`,
          needsDoctorProfile
            ? [
                { text: 'IR AO MEU PERFIL', onPress: () => router.push('/(doctor)/profile' as never) },
                { text: 'OK', style: 'cancel' },
              ]
            : [{ text: 'OK' }]
        );
        setActionLoading(false);
        return;
      }

      await signRequest(requestId, { pfxPassword: certPassword });
      await loadData();
      onSignSuccess();
      showToast({ message: 'Documento assinado digitalmente!', type: 'success' });
    } catch (e: unknown) {
      onSignError();
      const err = e as { missingFields?: string[]; messages?: string[]; message?: string } | undefined;
      if (err?.missingFields?.length || err?.messages?.length) {
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
      } else {
        const message = getApiErrorMessage(e) || 'Senha incorreta ou erro na assinatura.';
        showToast({ message, type: 'error' });
      }
    } finally {
      setActionLoading(false);
    }
  }, [requestId, request, certPassword, loadData, onSignSuccess, onSignError, router]);

  const handleAcceptConsultation = useCallback(async () => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      await acceptConsultation(requestId);
      loadData();
      showToast({ message: 'Consulta aceita!', type: 'success' });
    } catch (e: unknown) {
      showToast({ message: (e as Error)?.message || 'Falha ao aceitar.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }, [requestId, loadData]);

  return {
    actionLoading,
    handleApprove,
    handleReject,
    handleSign,
    handleAcceptConsultation,
  };
}
