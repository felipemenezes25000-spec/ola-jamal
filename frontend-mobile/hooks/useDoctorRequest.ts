/**
 * useDoctorRequest — Orchestrator hook for the doctor request detail screen.
 *
 * Composes:
 * - requestCache (in-memory LRU for instant initial render)
 * - useRequestActions (approve, reject, sign, accept handlers)
 *
 * Owns: data loading, form state (reject, sign, conduct), permission flags.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getRequestById, updateConduct } from '../lib/api';
import type { RequestResponseDto } from '../types/database';
import { showToast } from '../components/ui/Toast';
import { useRequestUpdated } from './useRequestUpdated';
import { useRequestActions } from './useRequestActions';
import { getCachedRequest, cacheRequest } from '../lib/requestCache';

// Re-export for backward compatibility (dashboard, [id].tsx, requests.tsx)
export { cacheRequest } from '../lib/requestCache';

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
  const requestId = (Array.isArray(id) ? id[0] : id) ?? '';
  const cached = getCachedRequest(requestId);

  // ── Data state ──

  const [request, setRequest] = useState<RequestResponseDto | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [loadError, setLoadError] = useState(false);
  const hasDataRef = useRef(!!cached);

  // ── Form state ──

  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [showSignForm, setShowSignForm] = useState(false);
  const [conductNotes, setConductNotes] = useState('');
  const [includeConductInPdf, setIncludeConductInPdf] = useState(true);
  const [savingConduct, setSavingConduct] = useState(false);

  // ── Data loading ──

  const loadData = useCallback(async () => {
    if (!requestId) return;
    try {
      setLoadError(false);
      const fresh = await getRequestById(requestId);
      setRequest(fresh);
      hasDataRef.current = true;
      cacheRequest(fresh);
    } catch {
      if (__DEV__) console.warn('Error loading request');
      if (!hasDataRef.current) setLoadError(true);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- request used only for setLoadError fallback
  }, [requestId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useRequestUpdated(requestId || undefined, loadData);

  // ── Sync conduct form with loaded request ──

  useEffect(() => {
    if (!request) return;
    setConductNotes(request.doctorConductNotes || '');
    setIncludeConductInPdf(request.includeConductInPdf ?? true);
  }, [request?.id, request?.doctorConductNotes, request?.includeConductInPdf, request]);

  // ── Conduct save ──

  const handleSaveConduct = async () => {
    if (!requestId || !request) return;
    setSavingConduct(true);
    try {
      const updated = await updateConduct(request.id, {
        conductNotes: conductNotes.trim() ? conductNotes.trim() : null,
        includeConductInPdf,
      });
      setRequest(updated);
      cacheRequest(updated);
      showToast({ message: 'Conduta salva no prontuário.', type: 'success' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Falha ao salvar conduta. Tente novamente.';
      showToast({ message, type: 'error' });
    } finally {
      setSavingConduct(false);
    }
  };

  // ── Action handlers (composed hook) ──

  const {
    actionLoading,
    handleApprove,
    handleReject,
    handleSign,
    handleAcceptConsultation,
  } = useRequestActions({
    requestId,
    request,
    rejectionReason,
    certPassword,
    loadData,
    onRejectSuccess: () => setShowRejectForm(false),
    onSignSuccess: () => {
      setShowSignForm(false);
      setCertPassword('');
    },
    onSignError: () => setCertPassword(''),
  });

  // ── Permission flags ──

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
