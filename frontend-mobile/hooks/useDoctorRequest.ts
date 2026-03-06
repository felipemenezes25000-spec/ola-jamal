import { useState, useCallback, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  getRequestById,
  approveRequest,
  rejectRequest,
  signRequest,
  acceptConsultation,
  updateConduct,
  validatePrescription,
} from '../lib/api';
import { RequestResponseDto } from '../types/database';
import { showToast } from '../components/ui/Toast';
import { getApiErrorMessage } from '../lib/api-client';
import { useRequestUpdated } from './useRequestUpdated';

const _requestCache = new Map<string, RequestResponseDto>();
export function cacheRequest(r: RequestResponseDto) {
  _requestCache.set(r.id, r);
}

export interface UseDoctorRequestReturn {
  request: RequestResponseDto | null;
  loading: boolean;
  loadError: boolean;
  actionLoading: boolean;

  rejectionReason: string;
  setRejectionReason: (v: string) => void;
  showRejectForm: boolean;
  setShowRejectForm: (v: boolean) => void;

  certPassword: string;
  setCertPassword: (v: string) => void;
  showSignForm: boolean;
  setShowSignForm: (v: boolean) => void;

  conductNotes: string;
  setConductNotes: (v: string) => void;
  includeConductInPdf: boolean;
  setIncludeConductInPdf: (v: boolean | ((prev: boolean) => boolean)) => void;
  savingConduct: boolean;

  loadData: () => Promise<void>;
  handleSaveConduct: () => Promise<void>;
  handleApprove: () => void;
  handleReject: () => Promise<void>;
  handleSign: () => Promise<void>;
  handleAcceptConsultation: () => Promise<void>;

  canApprove: boolean;
  canReject: boolean;
  canSign: boolean;
  canAccept: boolean;
  canVideo: boolean;
  isInQueue: boolean;

  requestId: string;
}

export function useDoctorRequest(): UseDoctorRequestReturn {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const requestId = (Array.isArray(id) ? id[0] : id) ?? '';
  const cached = _requestCache.get(requestId);

  const [request, setRequest] = useState<RequestResponseDto | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [showSignForm, setShowSignForm] = useState(false);
  const [conductNotes, setConductNotes] = useState('');
  const [includeConductInPdf, setIncludeConductInPdf] = useState(true);
  const [savingConduct, setSavingConduct] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    if (!requestId) return;
    try {
      setLoadError(false);
      const fresh = await getRequestById(requestId);
      if (__DEV__) {
        console.log('[DOCTOR_DETAIL] prescriptionImages:', JSON.stringify(fresh.prescriptionImages));
        console.log('[DOCTOR_DETAIL] examImages:', JSON.stringify(fresh.examImages));
      }
      setRequest(fresh);
      _requestCache.set(requestId, fresh);
    } catch {
      console.error('Error loading request');
      if (!request) setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useRequestUpdated(requestId || undefined, loadData);

  useEffect(() => {
    if (!request) return;
    setConductNotes(request.doctorConductNotes || '');
    setIncludeConductInPdf(request.includeConductInPdf ?? true);
  }, [request?.id, request?.doctorConductNotes, request?.includeConductInPdf]);

  const handleSaveConduct = async () => {
    if (!requestId || !request) return;
    setSavingConduct(true);
    try {
      const updated = await updateConduct(request.id, {
        conductNotes: conductNotes.trim() ? conductNotes.trim() : null,
        includeConductInPdf,
      });
      setRequest(updated);
      _requestCache.set(requestId, updated);
      showToast({ message: 'Conduta salva no prontuário.', type: 'success' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Falha ao salvar conduta. Tente novamente.';
      showToast({
        message,
        type: 'error',
      });
    } finally {
      setSavingConduct(false);
    }
  };

  const executeApprove = async () => {
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
  };

  const handleApprove = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Confirma a aprovação?')) executeApprove();
    } else {
      Alert.alert('Aprovar', 'Confirma a aprovação?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprovar', onPress: executeApprove },
      ]);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      showToast({ message: 'Informe o motivo da rejeição.', type: 'warning' });
      return;
    }
    if (!requestId) return;
    setActionLoading(true);
    try {
      await rejectRequest(requestId, rejectionReason.trim());
      loadData();
      setShowRejectForm(false);
      showToast({ message: 'Pedido rejeitado.', type: 'info' });
    } catch (e: unknown) {
      showToast({ message: (e as Error)?.message || 'Falha ao rejeitar.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSign = async () => {
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
      setShowSignForm(false);
      setCertPassword('');
      showToast({ message: 'Documento assinado digitalmente!', type: 'success' });
    } catch (e: unknown) {
      setCertPassword('');
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
  };

  const handleAcceptConsultation = async () => {
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
  };

  const canApprove = !!(request && (request.status === 'submitted' || request.status === 'in_review') && request.requestType !== 'consultation');
  const canReject = !!(request && (request.status === 'submitted' || request.status === 'in_review'));
  const canSign = !!(request && request.status === 'paid' && request.requestType !== 'consultation');
  const canAccept = !!(request && request.status === 'searching_doctor' && request.requestType === 'consultation');
  const canVideo = !!(request && ['paid', 'in_consultation'].includes(request.status) && request.requestType === 'consultation');
  const isInQueue = !!(request && request.status === 'submitted' && !request.doctorId);

  return {
    request,
    loading,
    loadError,
    actionLoading,

    rejectionReason,
    setRejectionReason,
    showRejectForm,
    setShowRejectForm,

    certPassword,
    setCertPassword,
    showSignForm,
    setShowSignForm,

    conductNotes,
    setConductNotes,
    includeConductInPdf,
    setIncludeConductInPdf,
    savingConduct,

    loadData,
    handleSaveConduct,
    handleApprove,
    handleReject,
    handleSign,
    handleAcceptConsultation,

    canApprove,
    canReject,
    canSign,
    canAccept,
    canVideo,
    isInQueue,

    requestId,
  };
}
