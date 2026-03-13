/**
 * useRequestEditor — Lógica do editor de receita/exame do médico.
 *
 * Extraído de doctor-request/editor/[id].tsx para reduzir complexidade do screen.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import {
  getRequestById,
  signRequest,
  getPreviewPdf,
  getPreviewExamPdf,
  updatePrescriptionContent,
  updateExamContent,
  updateConduct,
  validatePrescription,
} from '../lib/api';
import { RequestResponseDto, PrescriptionKind } from '../types/database';
import { searchCid, type CidMedicationItem } from '../lib/cid-medications';
import { showToast } from '../components/ui/Toast';
import { getApiErrorMessage } from '../lib/api-client';
import { nav } from '../lib/navigation';
import type { Router } from 'expo-router';

function parseAiMedications(aiExtractedJson: string | null): string[] {
  if (!aiExtractedJson) return [];
  try {
    const obj = JSON.parse(aiExtractedJson) as { medications?: unknown[] };
    const arr = obj?.medications;
    if (Array.isArray(arr)) {
      return arr.map((m) => String(m ?? '').trim()).filter(Boolean);
    }
  } catch {
    if (__DEV__) console.warn('[parseAiMedications] JSON parse failed');
  }
  return [];
}

async function blobToBase64(blob: Blob): Promise<string> {
  if (Platform.OS !== 'web') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl?.split(',')[1] ?? '');
      };
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

export interface UseRequestEditorOptions {
  requestId: string;
  router: Router;
}

export interface UseRequestEditorReturn {
  request: RequestResponseDto | null;
  loading: boolean;
  loadError: boolean;
  medications: string[];
  setMedications: React.Dispatch<React.SetStateAction<string[]>>;
  exams: string[];
  setExams: React.Dispatch<React.SetStateAction<string[]>>;
  prescriptionKind: PrescriptionKind;
  setPrescriptionKind: React.Dispatch<React.SetStateAction<PrescriptionKind>>;
  rejectedSuggestions: Set<string>;
  setRejectedSuggestions: React.Dispatch<React.SetStateAction<Set<string>>>;
  editingSuggestionIndex: number | null;
  setEditingSuggestionIndex: React.Dispatch<React.SetStateAction<number | null>>;
  editingSuggestionValue: string;
  setEditingSuggestionValue: React.Dispatch<React.SetStateAction<string>>;
  cidQuery: string;
  setCidQuery: React.Dispatch<React.SetStateAction<string>>;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  conductNotes: string;
  setConductNotes: React.Dispatch<React.SetStateAction<string>>;
  includeInPdf: boolean;
  setIncludeInPdf: React.Dispatch<React.SetStateAction<boolean>>;
  saving: boolean;
  signing: boolean;
  certPassword: string;
  setCertPassword: React.Dispatch<React.SetStateAction<string>>;
  showSignForm: boolean;
  setShowSignForm: React.Dispatch<React.SetStateAction<boolean>>;
  signFormDoctorProfileBlocked: boolean;
  setSignFormDoctorProfileBlocked: React.Dispatch<React.SetStateAction<boolean>>;
  pdfUri: string | null;
  pdfLoading: boolean;
  complianceValidation: { valid: boolean; messages?: string[]; missingFields?: string[] } | null;
  loadRequest: () => Promise<void>;
  loadPdfPreview: () => Promise<void>;
  refreshCompliance: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleSign: () => Promise<void>;
  suggestedFromAi: string[];
  cidResults: CidMedicationItem[];
  acceptSuggestion: (med: string) => void;
  acceptAllSuggestions: () => void;
  rejectSuggestion: (med: string) => void;
  startEditSuggestion: (med: string, index: number) => void;
  confirmEditSuggestion: () => void;
  cancelEditSuggestion: () => void;
  addFromCid: (med: string) => void;
  addCustom: () => void;
  removeMedication: (i: number) => void;
  updateMedication: (i: number, value: string) => void;
  setLoadError: React.Dispatch<React.SetStateAction<boolean>>;
  retryLoad: () => void;
  pdfBlobUrlRef: React.MutableRefObject<string | null>;
}

export function useRequestEditor({ requestId, router }: UseRequestEditorOptions): UseRequestEditorReturn {
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [medications, setMedications] = useState<string[]>([]);
  const [exams, setExams] = useState<string[]>([]);
  const [prescriptionKind, setPrescriptionKind] = useState<PrescriptionKind>('simple');
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(new Set());
  const [editingSuggestionIndex, setEditingSuggestionIndex] = useState<number | null>(null);
  const [editingSuggestionValue, setEditingSuggestionValue] = useState('');
  const [cidQuery, setCidQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [conductNotes, setConductNotes] = useState('');
  const [includeInPdf, setIncludeInPdf] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [showSignForm, setShowSignForm] = useState(false);
  const [signFormDoctorProfileBlocked, setSignFormDoctorProfileBlocked] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [complianceValidation, setComplianceValidation] = useState<{ valid: boolean; messages?: string[]; missingFields?: string[] } | null>(null);
  const pdfBlobUrlRef = useRef<string | null>(null);

  const isExam = request?.requestType === 'exam';

  useEffect(() => {
    if (!showSignForm || !requestId) return;
    let cancelled = false;
    validatePrescription(requestId)
      .then((v) => {
        if (cancelled) return;
        const needs = !v.valid && (v.missingFields ?? []).some(
          (f) => f.includes('médico.endereço') || f.includes('médico.telefone')
        );
        setSignFormDoctorProfileBlocked(!v.valid && needs);
      })
      .catch(() => {
        if (!cancelled) setSignFormDoctorProfileBlocked(false);
      });
    return () => { cancelled = true; };
  }, [showSignForm, requestId]);

  const refreshCompliance = useCallback(async () => {
    if (!requestId) return;
    try {
      const v = await validatePrescription(requestId);
      setComplianceValidation(v);
    } catch {
      setComplianceValidation(null);
    }
  }, [requestId]);

  const loadRequest = useCallback(async () => {
    if (!requestId) return;
    try {
      const data = await getRequestById(requestId);
      setRequest(data);
      const meds = data.medications?.filter(Boolean) ?? [];
      setMedications(meds.length > 0 ? meds : []);
      const examList = data.exams?.filter(Boolean) ?? [];
      setExams(examList.length > 0 ? examList : ['']);
      setNotes(data.notes ?? '');
      setConductNotes(data.doctorConductNotes ?? '');
      setIncludeInPdf(data.includeConductInPdf !== false);
      setPrescriptionKind((data.prescriptionKind as PrescriptionKind) || 'simple');
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  const retryLoad = useCallback(() => {
    setLoadError(false);
    setLoading(true);
    loadRequest();
  }, [loadRequest]);

  const loadPdfPreview = useCallback(async () => {
    if (!requestId || !request) return;
    setPdfLoading(true);
    try {
      const getPreview = request.requestType === 'exam' ? getPreviewExamPdf : getPreviewPdf;
      const blob = await getPreview(requestId);
      if (!blob || blob.size === 0) {
        setPdfUri(null);
        showToast({ message: request.requestType === 'exam' ? 'Preview não disponível para o pedido de exame.' : 'Preview não disponível. Verifique se há medicamentos na receita.', type: 'warning' });
        return;
      }
      if (Platform.OS === 'web') {
        if (pdfBlobUrlRef.current) {
          URL.revokeObjectURL(pdfBlobUrlRef.current);
          pdfBlobUrlRef.current = null;
        }
        const url = URL.createObjectURL(blob);
        pdfBlobUrlRef.current = url;
        setPdfUri(url);
      } else {
        const base64 = await blobToBase64(blob);
        if (!base64 || base64.length < 100) {
          setPdfUri(null);
          showToast({ message: 'Erro ao processar o PDF. Tente novamente.', type: 'error' });
          return;
        }
        setPdfUri(`data:application/pdf;base64,${base64}`);
      }
    } catch (e: unknown) {
      setPdfUri(null);
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      showToast({ message: msg || 'Não foi possível carregar o preview da receita.', type: 'error' });
    } finally {
      setPdfLoading(false);
    }
  }, [requestId, request?.requestType]);

  const handleSave = useCallback(async () => {
    if (isExam) {
      const examList = exams.map((e) => e.trim()).filter(Boolean);
      setSaving(true);
      try {
        await updateExamContent(requestId, { exams: examList.length > 0 ? examList : undefined, notes: notes.trim() || undefined });
        await updateConduct(requestId, { conductNotes: conductNotes.trim() || undefined, includeConductInPdf: includeInPdf });
        await loadRequest();
        await loadPdfPreview();
        await refreshCompliance();
        showToast({ message: 'Alterações salvas. Preview atualizado.', type: 'success' });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
        showToast({ message: msg || 'Falha ao salvar.', type: 'error' });
      } finally {
        setSaving(false);
      }
      return;
    }
    const meds = medications.map((m) => m.trim()).filter(Boolean);
    if (meds.length === 0) {
      showToast({ message: 'Adicione ao menos um medicamento à receita.', type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await updatePrescriptionContent(requestId, { medications: meds, notes: notes.trim() || undefined, prescriptionKind });
      await updateConduct(requestId, { conductNotes: conductNotes.trim() || undefined, includeConductInPdf: includeInPdf });
      await loadRequest();
      await loadPdfPreview();
      await refreshCompliance();
      showToast({ message: 'Alterações salvas. Preview atualizado.', type: 'success' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      showToast({ message: msg || 'Falha ao salvar.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [requestId, isExam, medications, exams, notes, conductNotes, includeInPdf, prescriptionKind, loadRequest, loadPdfPreview, refreshCompliance]);

  const handleSign = useCallback(async () => {
    if (!certPassword.trim()) {
      showToast({ message: 'Digite a senha do certificado.', type: 'warning' });
      return;
    }
    setSigning(true);
    try {
      if (isExam) {
        const examList = exams.map((e) => e.trim()).filter(Boolean);
        await updateExamContent(requestId, { exams: examList.length > 0 ? examList : undefined, notes: notes.trim() || undefined });
      } else {
        await updatePrescriptionContent(requestId, {
          medications: medications.map((m) => m.trim()).filter(Boolean),
          notes: notes.trim() || undefined,
          prescriptionKind,
        });
      }
      await updateConduct(requestId, { conductNotes: conductNotes.trim() || undefined, includeConductInPdf: includeInPdf });
      const validation = await validatePrescription(requestId);
      if (!validation.valid) {
        const needsPatientProfile = (validation.missingFields ?? []).some(
          (f) => f.includes('paciente.sexo') || f.includes('paciente.data_nascimento') || f.includes('paciente.endereço')
        );
        const needsDoctorProfile = (validation.missingFields ?? []).some(
          (f) => f.includes('médico.endereço') || f.includes('médico.telefone')
        );
        const checklist = (validation.messages ?? []).join('\n• ');
        const action = needsPatientProfile
          ? 'O paciente precisa completar sexo, data de nascimento ou endereço no perfil.'
          : needsDoctorProfile
            ? 'Para assinar receita simples, é obrigatório preencher endereço e telefone profissional no seu perfil de médico.'
            : 'Corrija os campos indicados antes de assinar.';
        Alert.alert(
          'Receita incompleta',
          `${action}\n\n• ${checklist}`,
          needsDoctorProfile
            ? [
                { text: 'IR AO MEU PERFIL', onPress: () => nav.push(router, '/(doctor)/profile') },
                { text: 'OK', style: 'cancel' },
              ]
            : [{ text: 'OK' }]
        );
        setSigning(false);
        return;
      }
      await signRequest(requestId, { pfxPassword: certPassword });
      setShowSignForm(false);
      setCertPassword('');
      showToast({ message: 'Documento assinado digitalmente!', type: 'success' });
      router.back();
    } catch (e: unknown) {
      const err = e as { missingFields?: string[]; messages?: string[]; message?: string };
      if (err?.missingFields?.length || err?.messages?.length) {
        const checklist = (err.messages ?? [err.message]).join('\n• ');
        const needsDoctorProfile = (err.missingFields ?? []).some(
          (f) => f.includes('médico.endereço') || f.includes('médico.telefone')
        );
        Alert.alert(
          'Receita incompleta',
          needsDoctorProfile
            ? `Para assinar, preencha endereço e telefone profissional no seu perfil de médico.\n\n• ${checklist}`
            : `Verifique os campos obrigatórios:\n\n• ${checklist}`,
          needsDoctorProfile
            ? [
                { text: 'IR AO MEU PERFIL', onPress: () => nav.push(router, '/(doctor)/profile') },
                { text: 'OK', style: 'cancel' },
              ]
            : [{ text: 'OK' }]
        );
      } else {
        showToast({ message: getApiErrorMessage(e) || 'Senha incorreta ou erro na assinatura.', type: 'error' });
      }
    } finally {
      setSigning(false);
    }
  }, [requestId, isExam, medications, exams, notes, conductNotes, includeInPdf, prescriptionKind, certPassword, router]);

  const suggestedFromAi = useMemo(() => {
    const fromAi = parseAiMedications(request?.aiExtractedJson ?? null);
    const accepted = new Set(medications);
    return fromAi.filter((m) => !accepted.has(m) && !rejectedSuggestions.has(m));
  }, [request?.aiExtractedJson, medications, rejectedSuggestions]);

  const cidResults = useMemo(() => searchCid(cidQuery), [cidQuery]);

  const acceptSuggestion = useCallback((med: string) => {
    const trimmed = med.trim();
    if (!trimmed) return;
    setMedications((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const acceptAllSuggestions = useCallback(() => {
    setMedications((prev) => {
      const set = new Set(prev);
      suggestedFromAi.filter((m) => m.trim()).forEach((m) => set.add(m.trim()));
      return Array.from(set);
    });
    setRejectedSuggestions(new Set());
  }, [suggestedFromAi]);

  const rejectSuggestion = useCallback((med: string) => {
    setRejectedSuggestions((prev) => new Set(prev).add(med));
  }, []);

  const startEditSuggestion = useCallback((med: string, index: number) => {
    setEditingSuggestionIndex(index);
    setEditingSuggestionValue(med);
  }, []);

  const confirmEditSuggestion = useCallback(() => {
    if (editingSuggestionIndex !== null && editingSuggestionValue.trim()) {
      acceptSuggestion(editingSuggestionValue.trim());
      setEditingSuggestionIndex(null);
      setEditingSuggestionValue('');
    }
  }, [editingSuggestionIndex, editingSuggestionValue, acceptSuggestion]);

  const cancelEditSuggestion = useCallback(() => {
    setEditingSuggestionIndex(null);
    setEditingSuggestionValue('');
  }, []);

  const addFromCid = useCallback((med: string) => {
    setMedications((prev) => (prev.includes(med) ? prev : [...prev, med]));
  }, []);

  const addCustom = useCallback(() => setMedications((prev) => [...prev, '']), []);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  useEffect(() => {
    if (request?.requestType === 'prescription' || request?.requestType === 'exam') {
      loadPdfPreview();
    }
    return () => {
      if (Platform.OS === 'web' && pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
    };
  }, [request?.id, request?.requestType, loadPdfPreview]);

  useEffect(() => {
    if ((request?.requestType === 'prescription' || request?.requestType === 'exam') && requestId) {
      refreshCompliance();
    }
  }, [request?.id, request?.requestType, requestId, refreshCompliance]);

  const removeMedication = useCallback((i: number) => {
    setMedications((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const updateMedication = useCallback((i: number, value: string) => {
    setMedications((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }, []);

  return {
    request,
    loading,
    loadError,
    medications,
    setMedications,
    exams,
    setExams,
    prescriptionKind,
    setPrescriptionKind,
    rejectedSuggestions,
    setRejectedSuggestions,
    editingSuggestionIndex,
    setEditingSuggestionIndex,
    editingSuggestionValue,
    setEditingSuggestionValue,
    cidQuery,
    setCidQuery,
    notes,
    setNotes,
    conductNotes,
    setConductNotes,
    includeInPdf,
    setIncludeInPdf,
    saving,
    signing,
    certPassword,
    setCertPassword,
    showSignForm,
    setShowSignForm,
    signFormDoctorProfileBlocked,
    setSignFormDoctorProfileBlocked,
    pdfUri,
    pdfLoading,
    complianceValidation,
    loadRequest,
    loadPdfPreview,
    refreshCompliance,
    handleSave,
    handleSign,
    suggestedFromAi,
    cidResults,
    acceptSuggestion,
    acceptAllSuggestions,
    rejectSuggestion,
    startEditSuggestion,
    confirmEditSuggestion,
    cancelEditSuggestion,
    addFromCid,
    addCustom,
    removeMedication,
    updateMedication,
    setLoadError,
    retryLoad,
    pdfBlobUrlRef,
  };
}
