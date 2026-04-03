/**
 * Tela Pós-Consulta — Design aprovado.
 * Emite receita + exames pré-preenchidos pela IA.
 * O médico revisa, edita e assina tudo de uma vez.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { emitPostConsultationDocuments } from '../../lib/api-requests';
import { getApiErrorMessage } from '../../lib/api-client';
import type { RequestResponseDto } from '../../types/database';
import type {
  PostConsultationEmitRequest,
  PrescriptionItemEmit,
  ExamItemEmit,
} from '../../types/postConsultation';
import { parseAnamnesis, type AnamnesisData } from '../../lib/domain/anamnesis';
import { CID_PACKAGES, EXAM_PACKAGES, getCidPackage, type ExamPackage } from '../../lib/data/cidPackages';

// ── Types ──

interface Props {
  request: RequestResponseDto;
  onComplete: () => void;
  onBack: () => void;
}

// ── Helpers ──

/** Extract only the ICD-10 code (e.g. "J06.9") from an AI-generated string
 *  that may contain a description like "J06.9 — Infecção aguda das vias aéreas". */
function extractCidCode(raw: string): string {
  // Match ICD-10 pattern: letter + digits + optional dot + digits (e.g. J06.9, A01.23, Z76)
  const m = raw.match(/[A-Z]\d{2}(?:\.\d{1,2})?/i);
  return m ? m[0].toUpperCase() : raw.toUpperCase().slice(0, 10);
}

function extractCidFromAnamnesis(anamnesis: AnamnesisData | null): string | null {
  if (!anamnesis) return null;
  // Extract from first diagnostico_diferencial item
  const dd = anamnesis.diagnostico_diferencial;
  if (Array.isArray(dd) && dd.length > 0) {
    const first = dd[0];
    if (typeof first === 'object' && first !== null && 'cid' in first) {
      const cid = (first as { cid?: string }).cid;
      if (typeof cid === 'string' && cid.trim().length > 0) {
        return extractCidCode(cid.trim());
      }
    }
  }
  return null;
}

function buildMedsFromAnamnesis(anamnesis: AnamnesisData | null): PrescriptionItemEmit[] {
  if (!anamnesis?.medicamentos_sugeridos || !Array.isArray(anamnesis.medicamentos_sugeridos)) return [];
  return anamnesis.medicamentos_sugeridos
    .filter((m): m is NonNullable<typeof m> => m != null)
    .map((m) => {
      if (typeof m === 'string') return { drug: m };
      return {
        drug: m.nome ?? 'Medicamento',
        concentration: m.dose ?? undefined,
        form: m.via ?? undefined,
        posology: m.posologia ?? undefined,
        duration: m.duracao ?? undefined,
        notes: m.indicacao ?? undefined,
      };
    });
}

function buildExamsFromAnamnesis(anamnesis: AnamnesisData | null): ExamItemEmit[] {
  if (!anamnesis?.exames_sugeridos || !Array.isArray(anamnesis.exames_sugeridos)) return [];
  return anamnesis.exames_sugeridos
    .filter((e): e is NonNullable<typeof e> => e != null)
    .map((e) => {
      if (typeof e === 'string') return { type: 'laboratorial', description: e };
      return {
        type: 'laboratorial',
        code: e.codigo_tuss ?? undefined,
        description: e.nome ?? 'Exame',
      };
    });
}

function buildReferralFromAnamnesis(anamnesis: AnamnesisData | null): { professional: string; specialty?: string; reason: string } | null {
  const enc = anamnesis?.encaminhamento_sugerido;
  if (!enc?.profissional && !enc?.medico && !enc?.motivo && !enc?.reason) return null;
  const professional = enc.profissional ?? enc.medico ?? '';
  const reason = enc.motivo ?? enc.reason ?? enc.indication ?? '';
  if (!professional && !reason) return null;
  return {
    professional,
    specialty: enc.especialidade,
    reason,
  };
}

// ── Main Component ──

export default function PostConsultationScreen({ request, onComplete, onBack }: Props) {
  const { colors } = useAppTheme();
  const S = useMemo(() => makeStyles(colors), [colors]);
  const isPsy = request.consultationType === 'psicologo';

  // ── Parse anamnesis ──
  const anamnesis = useMemo(
    () => parseAnamnesis(request.consultationAnamnesis),
    [request.consultationAnamnesis]
  );

  const detectedCid = useMemo(() => extractCidFromAnamnesis(anamnesis), [anamnesis]);
  const cidPkg = useMemo(() => detectedCid ? getCidPackage(detectedCid) : null, [detectedCid]);

  /** Pacotes do backend (idade/sexo); fallback local se a API não enviar. */
  const examQuickPackages = useMemo((): ExamPackage[] => {
    const fromApi = request.examQuickPackages;
    if (fromApi && fromApi.length > 0) {
      return fromApi.map((p) => ({
        key: p.key,
        name: p.name,
        exams: p.exams,
        justification: p.justification,
      }));
    }
    return EXAM_PACKAGES;
  }, [request.examQuickPackages]);

  // ── State: Document toggles ──
  // Psicólogo: only referral available (no prescription, no exams, no CID)
  const [rxEnabled, setRxEnabled] = useState(!isPsy);
  const [exEnabled, setExEnabled] = useState(false);
  const [refEnabled, setRefEnabled] = useState(isPsy);

  // ── State: Sections expanded ──
  const [rxOpen, setRxOpen] = useState(!isPsy);
  const [exOpen, setExOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(isPsy);
  const [cidPickerOpen, setCidPickerOpen] = useState(false);
  const [exListExpanded, setExListExpanded] = useState(false);

  // ── State: Prescription ──
  const [rxType, setRxType] = useState<'simples' | 'controlado'>('simples');
  const [rxGeneralInstructions, setRxGeneralInstructions] = useState('');
  const [meds, setMeds] = useState<PrescriptionItemEmit[]>(() =>
    buildMedsFromAnamnesis(anamnesis).length > 0
      ? buildMedsFromAnamnesis(anamnesis)
      : (cidPkg?.medications ?? []).map((m) => ({
          drug: m.drug, posology: m.posology, notes: m.indication,
        }))
  );

  // ── State: Exams ──
  const [exams, setExams] = useState<ExamItemEmit[]>(() =>
    buildExamsFromAnamnesis(anamnesis).length > 0
      ? buildExamsFromAnamnesis(anamnesis)
      : (cidPkg?.exams ?? []).map((e) => ({ type: 'laboratorial', description: e }))
  );
  const [examJustification, setExamJustification] = useState(cidPkg?.examJustification ?? '');

  // ── State: Selected CID (shared by CID picker, payload, referral) ──
  const [certCid, setCertCid] = useState(detectedCid ?? '');

  // ── State: Referral ──
  const refSug = useMemo(() => buildReferralFromAnamnesis(anamnesis), [anamnesis]);
  const [refProfessional, setRefProfessional] = useState('');
  const [refSpecialty, setRefSpecialty] = useState('');
  const [refReason, setRefReason] = useState('');

  // Sync referral from anamnesis when it loads
  React.useEffect(() => {
    if (refSug?.professional || refSug?.reason) {
      setRefProfessional(refSug.professional ?? '');
      setRefSpecialty(refSug.specialty ?? '');
      setRefReason(refSug.reason ?? '');
      setRefEnabled(true);
      setRefOpen(true);
    }
  }, [refSug]);

  // ── State: Submission ──
  const [submitting, setSubmitting] = useState(false);

  // ── State: Senha do certificado (para assinatura ICP-Brasil) ──
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const certPasswordRef = useRef('');
  const updateCertPassword = useCallback((v: string) => {
    certPasswordRef.current = v;
    setCertPassword(v);
  }, []);

  // ── State: Modals (add/edit med & exam) ──
  const [medModalVisible, setMedModalVisible] = useState(false);
  const [editingMedIndex, setEditingMedIndex] = useState<number | null>(null);
  const [medForm, setMedForm] = useState<PrescriptionItemEmit>({ drug: '', posology: '', notes: '' });

  const [examModalVisible, setExamModalVisible] = useState(false);
  const [editingExamIndex, setEditingExamIndex] = useState<number | null>(null);
  const [examForm, setExamForm] = useState<ExamItemEmit>({ type: 'laboratorial', description: '' });

  // ── CID change: reload all data ──
  const loadCidPackage = useCallback((code: string) => {
    const pkg = getCidPackage(code);
    if (!pkg) return;
    setMeds(pkg.medications.map((m) => ({ drug: m.drug, posology: m.posology, notes: m.indication })));
    setExams(pkg.exams.map((e) => ({ type: 'laboratorial', description: e })));
    setExamJustification(pkg.examJustification);
    setCertCid(code);
    if (pkg.exams.length > 0) { setExEnabled(true); setExOpen(true); }
    setCidPickerOpen(false);
  }, []);

  // ── Remove item helpers ──
  const removeMed = (idx: number) => setMeds((prev) => prev.filter((_, i) => i !== idx));
  const removeExam = (idx: number) => setExams((prev) => prev.filter((_, i) => i !== idx));

  // ── Load exam package ──
  const loadExamPackage = useCallback((pkgKey: string) => {
    const pkg = examQuickPackages.find((p) => p.key === pkgKey);
    if (!pkg) return;
    setExams(pkg.exams.map((e) => ({ type: 'laboratorial', description: e })));
    setExamJustification(pkg.justification);
    setExEnabled(true);
    setExOpen(true);
  }, [examQuickPackages]);

  // ── Add/Edit medication ──
  const openAddMed = useCallback(() => {
    setEditingMedIndex(null);
    setMedForm({ drug: '', concentration: '', posology: '', notes: '' });
    setMedModalVisible(true);
  }, []);
  const openEditMed = useCallback((idx: number) => {
    const m = meds[idx];
    setEditingMedIndex(idx);
    setMedForm({
      drug: m.drug ?? '',
      concentration: m.concentration ?? '',
      posology: m.posology ?? '',
      notes: m.notes ?? '',
    });
    setMedModalVisible(true);
  }, [meds]);
  const saveMed = useCallback(() => {
    const drug = medForm.drug?.trim();
    if (!drug) {
      Alert.alert('Campo obrigatório', 'Informe o nome do medicamento.');
      return;
    }
    const item: PrescriptionItemEmit = {
      drug,
      concentration: medForm.concentration?.trim() || undefined,
      posology: medForm.posology?.trim() || undefined,
      notes: medForm.notes?.trim() || undefined,
    };
    if (editingMedIndex !== null) {
      setMeds((prev) => prev.map((m, i) => (i === editingMedIndex ? item : m)));
    } else {
      setMeds((prev) => [...prev, item]);
    }
    setMedModalVisible(false);
  }, [medForm, editingMedIndex]);

  // ── Add/Edit exam ──
  const openAddExam = useCallback(() => {
    setEditingExamIndex(null);
    setExamForm({ type: 'laboratorial', description: '' });
    setExamModalVisible(true);
  }, []);
  const openEditExam = useCallback((idx: number) => {
    const e = exams[idx];
    setEditingExamIndex(idx);
    setExamForm({ type: 'laboratorial', description: e.description ?? '' });
    setExamModalVisible(true);
  }, [exams]);
  const saveExam = useCallback(() => {
    const description = examForm.description?.trim();
    if (!description) {
      Alert.alert('Campo obrigatório', 'Informe a descrição do exame.');
      return;
    }
    const item: ExamItemEmit = { type: 'laboratorial', description };
    if (editingExamIndex !== null) {
      setExams((prev) => prev.map((e, i) => (i === editingExamIndex ? item : e)));
    } else {
      setExams((prev) => [...prev, item]);
    }
    setExEnabled(true);
    setExOpen(true);
    setExamModalVisible(false);
  }, [examForm, editingExamIndex]);

  // ── Computed ──
  const docCount = (rxEnabled ? 1 : 0) + (exEnabled ? 1 : 0) + (refEnabled ? 1 : 0);
  const docTags: string[] = [];
  if (rxEnabled) docTags.push(`Receita (${meds.length})`);
  if (exEnabled) docTags.push(`Exames (${exams.length})`);
  if (refEnabled) docTags.push('Encaminhamento');

  // ── Submit ──
  const handleSignClick = () => {
    if (docCount === 0) {
      Alert.alert('Nenhum documento', 'Ative pelo menos um documento para emitir.');
      return;
    }
    if (docCount > 4) {
      Alert.alert('Limite excedido', 'Máximo de 3 documentos: receita, exames e encaminhamento.');
      return;
    }
    updateCertPassword('');
    setPasswordModalVisible(true);
  };

  const handleSubmit = async () => {
    // Ref + state: evita senha vazia se houver dessincronia ref/React em inputs seguros
    const password = (certPasswordRef.current.trim() || certPassword.trim());
    setPasswordModalVisible(false);
    setSubmitting(true);
    if (!password) {
      Alert.alert('Erro', 'Senha do certificado é obrigatória.');
      setSubmitting(false);
      return;
    }
    try {
      const payload: PostConsultationEmitRequest = {
        requestId: request.id,
        certificatePassword: password,
        mainIcd10Code: isPsy ? undefined : (certCid || detectedCid || undefined),
        anamnesis: request.consultationAnamnesis ?? undefined,
        structuredAnamnesis: request.consultationAnamnesis ?? undefined,
        plan: request.doctorConductNotes ?? request.aiConductSuggestion ?? undefined,
      };

      if (rxEnabled && meds.length > 0) {
        payload.prescription = {
          type: rxType,
          items: meds,
          generalInstructions: rxGeneralInstructions.trim() || undefined,
        };
      }
      if (exEnabled && exams.length > 0) {
        payload.examOrder = { clinicalJustification: examJustification, items: exams };
      }
      if (refEnabled && refReason.trim()) {
        payload.referral = {
          professionalName: refProfessional.trim() || refSpecialty.trim() || 'Profissional',
          specialty: refSpecialty.trim() || undefined,
          reason: refReason.trim(),
          icd10Code: isPsy ? undefined : (certCid || detectedCid || undefined),
        };
      }

      const result = await emitPostConsultationDocuments(payload);
      const detail = result.errors?.length
        ? `${result.message}\n\nProblemas:\n${result.errors.join('\n')}`
        : result.message;
      Alert.alert(
        result.documentsEmitted > 0 ? 'Documentos emitidos' : 'Atenção',
        detail,
        [{ text: 'OK', onPress: result.documentsEmitted > 0 ? onComplete : undefined }]
      );
    } catch (err: unknown) {
      Alert.alert('Erro', getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──
  return (
    <View style={S.root}>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* CID Hero Card — medical only (psychologist does not use CID) */}
        {!isPsy && (
          <View style={S.cidCard}>
            <View style={S.cidBadge}>
              <Text style={S.cidBadgeText}>{certCid || detectedCid || '—'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.cidTitle}>
                {cidPkg?.name ?? CID_PACKAGES[certCid]?.name ?? 'CID não identificado'}
              </Text>
              <Text style={S.cidSub}>Documentos pré-preenchidos com base na transcrição da consulta.</Text>
              <TouchableOpacity onPress={() => setCidPickerOpen(!cidPickerOpen)}>
                <Text style={S.cidLink}>Trocar CID</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CID Picker (colapsável) — medical only */}
        {!isPsy && cidPickerOpen && (
          <View style={S.cidGrid}>
            {Object.values(CID_PACKAGES).map((pkg) => (
              <TouchableOpacity
                key={pkg.code}
                style={[S.cidOpt, pkg.code === certCid && S.cidOptActive]}
                onPress={() => loadCidPackage(pkg.code)}
              >
                <Text style={S.cidOptCode}>{pkg.code}</Text>
                <Text style={S.cidOptName}>{pkg.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ═══ RECEITA ═══ (medical only — psychologist cannot prescribe) */}
        {!isPsy && <View style={[S.panel, !rxEnabled && S.panelOff]}>
          <TouchableOpacity style={S.panelHead} onPress={() => rxEnabled && setRxOpen(!rxOpen)} activeOpacity={0.7}>
            <View style={[S.panelDot, { backgroundColor: '#2E5BFF' }]} />
            <Text style={S.panelName}>Receita</Text>
            <Text style={S.panelBadge}>{meds.length} ite{meds.length !== 1 ? 'ns' : 'm'}</Text>
            <Switch value={rxEnabled} onValueChange={(v) => { setRxEnabled(v); if (v) setRxOpen(true); }}
              trackColor={{ false: '#D4D7DF', true: '#2E5BFF' }} thumbColor="#fff" />
            <Ionicons name={rxOpen && rxEnabled ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {rxOpen && rxEnabled && (
            <View style={S.panelBody}>
              <View style={S.chips}>
                <TouchableOpacity style={[S.chip, rxType === 'simples' && S.chipOn]} onPress={() => setRxType('simples')}>
                  <Text style={[S.chipText, rxType === 'simples' && S.chipTextOn]}>Simples</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.chip, rxType === 'controlado' && S.chipOn]} onPress={() => setRxType('controlado')}>
                  <Text style={[S.chipText, rxType === 'controlado' && S.chipTextOn]}>Controlado</Text>
                </TouchableOpacity>
              </View>
              {meds.map((m, i) => (
                <View key={`med-${i}`} style={S.item}>
                  <Pressable style={{ flex: 1 }} onPress={() => openEditMed(i)}>
                    <View>
                      <Text style={S.itemName}>{m.drug}{m.concentration ? ` ${m.concentration}` : ''}</Text>
                      {(m.posology || m.notes) && (
                        <Text style={S.itemSub}>{[m.posology, m.notes].filter(Boolean).join(' · ')}</Text>
                      )}
                    </View>
                  </Pressable>
                  <TouchableOpacity style={S.itemEdit} onPress={() => openEditMed(i)} accessibilityLabel="Editar medicamento">
                    <Ionicons name="create-outline" size={18} color="#2E5BFF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={S.itemRemove} onPress={() => removeMed(i)} accessibilityLabel="Remover medicamento">
                    <Ionicons name="close" size={14} color="#E5484D" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={S.addBtn} onPress={openAddMed} accessibilityLabel="Adicionar medicamento">
                <Ionicons name="add" size={18} color="#2E5BFF" />
                <Text style={S.addBtnText}>Adicionar medicamento</Text>
              </TouchableOpacity>
              <View style={{ marginTop: 12 }}>
                <Text style={S.fieldLabel}>Instruções gerais (opcional)</Text>
                <TextInput
                  style={S.textArea}
                  value={rxGeneralInstructions}
                  onChangeText={setRxGeneralInstructions}
                  placeholder="Ex: Tomar após as refeições. Evitar álcool. Retornar em 15 dias."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          )}
        </View>}

        {/* ═══ EXAMES ═══ (medical only — psychologist does not order exams) */}
        {!isPsy && <View style={[S.panel, !exEnabled && S.panelOff]}>
          <TouchableOpacity style={S.panelHead} onPress={() => exEnabled && setExOpen(!exOpen)} activeOpacity={0.7}>
            <View style={[S.panelDot, { backgroundColor: '#00B27A' }]} />
            <Text style={S.panelName}>Exames</Text>
            <Text style={S.panelBadge}>{exams.length} exame{exams.length !== 1 ? 's' : ''}</Text>
            <Switch value={exEnabled} onValueChange={(v) => { setExEnabled(v); if (v) setExOpen(true); }}
              trackColor={{ false: '#D4D7DF', true: '#00B27A' }} thumbColor="#fff" />
            <Ionicons name={exOpen && exEnabled ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {exOpen && exEnabled && (
            <View style={S.panelBody}>
              {/* Exam Packages */}
              <Text style={S.label}>PACOTES RÁPIDOS</Text>
              <View style={S.pkgGrid}>
                {examQuickPackages.map((pkg) => (
                  <TouchableOpacity key={pkg.key} style={S.pkg} onPress={() => loadExamPackage(pkg.key)}>
                    <Text style={S.pkgName}>{pkg.name}</Text>
                    <Text style={S.pkgCount}>{pkg.exams.length} exames</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={S.divider} />
              {/* Exam Items (colapsável) */}
              {exams.slice(0, exListExpanded ? undefined : 3).map((e, i) => (
                <View key={`ex-${i}`} style={S.item}>
                  <Pressable style={{ flex: 1 }} onPress={() => openEditExam(i)}>
                    <Text style={S.itemName}>{e.description}</Text>
                  </Pressable>
                  <TouchableOpacity style={S.itemEdit} onPress={() => openEditExam(i)} accessibilityLabel="Editar exame">
                    <Ionicons name="create-outline" size={18} color="#2E5BFF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={S.itemRemove} onPress={() => removeExam(i)} accessibilityLabel="Remover exame">
                    <Ionicons name="close" size={14} color="#E5484D" />
                  </TouchableOpacity>
                </View>
              ))}
              {exams.length > 3 && (
                <TouchableOpacity style={S.expandBtn} onPress={() => setExListExpanded(!exListExpanded)}>
                  <Ionicons name={exListExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#2E5BFF" />
                  <Text style={S.expandBtnText}>{exListExpanded ? 'Recolher' : `Ver todos (${exams.length})`}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={S.addBtn} onPress={openAddExam} accessibilityLabel="Adicionar exame avulso">
                <Ionicons name="add" size={18} color="#2E5BFF" />
                <Text style={S.addBtnText}>Adicionar exame avulso</Text>
              </TouchableOpacity>
              <View style={{ marginTop: 10 }}>
                <Text style={S.fieldLabel}>Justificativa clínica</Text>
                <TextInput style={S.textArea} value={examJustification} onChangeText={setExamJustification}
                  placeholder="Preenchida ao selecionar pacote" multiline placeholderTextColor={colors.textMuted} />
              </View>
            </View>
          )}
        </View>}

        {/* ═══ ENCAMINHAMENTO ═══ */}
        <View style={[S.panel, !refEnabled && S.panelOff]}>
          <TouchableOpacity style={S.panelHead} onPress={() => refEnabled && setRefOpen(!refOpen)} activeOpacity={0.7}>
            <View style={[S.panelDot, { backgroundColor: '#7C3AED' }]} />
            <Text style={S.panelName}>Encaminhamento</Text>
            <Text style={S.panelBadge}>{refSpecialty.trim() || 'Especialidade'}</Text>
            <Switch value={refEnabled} onValueChange={(v) => { setRefEnabled(v); if (v) setRefOpen(true); }}
              trackColor={{ false: '#D4D7DF', true: '#7C3AED' }} thumbColor="#fff" />
            <Ionicons name={refOpen && refEnabled ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {refOpen && refEnabled && (
            <View style={S.panelBody}>
              <Text style={S.refHint}>
                {isPsy
                  ? 'Encaminhe o paciente para outro profissional ou serviço conforme avaliação psicológica.'
                  : 'Encaminhe o paciente para avaliação presencial conforme anamnese.'}
              </Text>
              <Text style={S.fieldLabel}>Especialidade *</Text>
              <TextInput style={S.input} value={refSpecialty} onChangeText={setRefSpecialty}
                placeholder={isPsy ? 'Ex: Psiquiatra, Neurologista, Clínico Geral' : 'Ex: Cardiologia, Fisioterapia'}
                placeholderTextColor={colors.textMuted} />
              <Text style={S.fieldLabel}>Médico ou profissional (opcional)</Text>
              <TextInput style={S.input} value={refProfessional} onChangeText={setRefProfessional}
                placeholder="Ex: Dr. João Silva" placeholderTextColor={colors.textMuted} />
              <Text style={S.fieldLabel}>Motivo / Indicação *</Text>
              <TextInput style={S.textArea} value={refReason} onChangeText={setRefReason}
                placeholder="Conforme anamnese, para avaliação de..." multiline placeholderTextColor={colors.textMuted} />
            </View>
          )}
        </View>

        {/* ═══ RESUMO ═══ */}
        <View style={S.summary}>
          <Text style={S.summaryTitle}>
            {docCount} documento{docCount !== 1 ? 's' : ''} pronto{docCount !== 1 ? 's' : ''} para assinatura
          </Text>
          <View style={S.tags}>
            {docTags.map((t, i) => (
              <View key={i} style={S.tag}>
                <Text style={S.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ═══ BOTÕES ═══ */}
        <TouchableOpacity style={S.signBtn} onPress={handleSignClick} disabled={submitting || docCount === 0}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
              <Text style={S.signBtnText}>Assinar e emitir documentos</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={S.wppBtn}>
          <Ionicons name="logo-whatsapp" size={20} color="#22C55E" />
          <Text style={S.wppBtnText}>Enviar por WhatsApp</Text>
        </TouchableOpacity>

        <Text style={S.footer}>
          Assinatura digital ICP-Brasil · QR Code verificável{'\n'}
          Prontuário atualizado automaticamente
        </Text>

      </ScrollView>

      {/* Modal: Senha do certificado */}
      <Modal visible={passwordModalVisible} transparent animationType="slide">
        <Pressable style={S.modalOverlay} onPress={() => setPasswordModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalKav}>
            <Pressable style={S.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name="lock-closed" size={24} color={colors.primary} />
                <Text style={S.modalTitle}>Senha do Certificado Digital</Text>
              </View>
              <Text style={[S.fieldLabel, { marginBottom: 8 }]}>
                Informe a senha do seu certificado A1 (PFX) para assinar os {docCount} documento(s).
              </Text>
              <TextInput
                style={S.input}
                value={certPassword}
                onChangeText={updateCertPassword}
                placeholder="Senha do certificado"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[S.fieldLabel, { marginTop: 8, fontSize: 12, color: colors.textMuted }]}>
                A senha é usada apenas para validar o certificado. Não é armazenada.
              </Text>
              <View style={S.modalActs}>
                <TouchableOpacity style={S.modalBtnSec} onPress={() => setPasswordModalVisible(false)}>
                  <Text style={S.modalBtnSecText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.modalBtnPri, !certPassword.trim() && { opacity: 0.5 }]}
                  onPress={() => certPassword.trim() && handleSubmit()}
                  disabled={!certPassword.trim() || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={S.modalBtnPriText}>Assinar e emitir</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal: Adicionar/Editar medicamento */}
      <Modal visible={medModalVisible} transparent animationType="slide">
        <Pressable style={S.modalOverlay} onPress={() => setMedModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalKav}>
            <Pressable style={S.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={S.modalTitle}>{editingMedIndex !== null ? 'Editar medicamento' : 'Adicionar medicamento'}</Text>
              <Text style={S.fieldLabel}>Medicamento *</Text>
              <TextInput style={S.input} value={medForm.drug} onChangeText={(v) => setMedForm((f) => ({ ...f, drug: v }))}
                placeholder="Ex: Dipirona 500mg" placeholderTextColor={colors.textMuted} />
              <Text style={S.fieldLabel}>Concentração (opcional)</Text>
              <TextInput style={S.input} value={medForm.concentration ?? ''} onChangeText={(v) => setMedForm((f) => ({ ...f, concentration: v }))}
                placeholder="Ex: 500mg" placeholderTextColor={colors.textMuted} />
              <Text style={S.fieldLabel}>Posologia (opcional)</Text>
              <TextInput style={S.input} value={medForm.posology ?? ''} onChangeText={(v) => setMedForm((f) => ({ ...f, posology: v }))}
                placeholder="Ex: VO 6/6h por 5 dias" placeholderTextColor={colors.textMuted} />
              <Text style={S.fieldLabel}>Indicação (opcional)</Text>
              <TextInput style={S.input} value={medForm.notes ?? ''} onChangeText={(v) => setMedForm((f) => ({ ...f, notes: v }))}
                placeholder="Ex: Febre e dor" placeholderTextColor={colors.textMuted} />
              <View style={S.modalActs}>
                <TouchableOpacity style={S.modalBtnSec} onPress={() => setMedModalVisible(false)}>
                  <Text style={S.modalBtnSecText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.modalBtnPri} onPress={saveMed}>
                  <Text style={S.modalBtnPriText}>{editingMedIndex !== null ? 'Salvar' : 'Adicionar'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal: Adicionar/Editar exame */}
      <Modal visible={examModalVisible} transparent animationType="slide">
        <Pressable style={S.modalOverlay} onPress={() => setExamModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalKav}>
            <Pressable style={S.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={S.modalTitle}>{editingExamIndex !== null ? 'Editar exame' : 'Adicionar exame avulso'}</Text>
              <Text style={S.fieldLabel}>Descrição do exame *</Text>
              <TextInput style={S.input} value={examForm.description} onChangeText={(v) => setExamForm((f) => ({ ...f, description: v }))}
                placeholder="Ex: Hemograma completo" placeholderTextColor={colors.textMuted} />
              <View style={S.modalActs}>
                <TouchableOpacity style={S.modalBtnSec} onPress={() => setExamModalVisible(false)}>
                  <Text style={S.modalBtnSecText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.modalBtnPri} onPress={saveExam}>
                  <Text style={S.modalBtnPriText}>{editingExamIndex !== null ? 'Salvar' : 'Adicionar'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Styles ──

function makeStyles(c: DesignColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F4F5F7' },
    scroll: { padding: 16, paddingBottom: 40 },

    // CID Card
    cidCard: {
      backgroundColor: '#F4F1FF', borderRadius: 16, padding: 18,
      flexDirection: 'row', alignItems: 'center', gap: 16,
      borderWidth: 1, borderColor: '#E2DEFF', marginBottom: 16,
    },
    cidBadge: {
      width: 56, height: 56, borderRadius: 14, backgroundColor: '#7B61FF',
      justifyContent: 'center', alignItems: 'center',
    },
    cidBadgeText: { color: '#fff', fontSize: 20, fontWeight: '600', letterSpacing: 0.5 },
    cidTitle: { fontSize: 16, fontWeight: '600', color: '#4C1D95', letterSpacing: -0.3 },
    cidSub: { fontSize: 12, color: '#7C3AED', marginTop: 4, lineHeight: 18 },
    cidLink: { fontSize: 12, color: '#7B61FF', fontWeight: '500', marginTop: 6 },

    cidGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
    },
    cidOpt: {
      width: '48%' as any, padding: 14, borderRadius: 12,
      borderWidth: 1.5, borderColor: '#ECEDF1', backgroundColor: '#fff',
    },
    cidOptActive: { borderColor: '#7B61FF', backgroundColor: '#F4F1FF' },
    cidOptCode: { fontSize: 14, fontWeight: '600', color: '#1A1D26' },
    cidOptName: { fontSize: 11, color: '#9498A8', marginTop: 2 },

    // Panels
    panel: {
      backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#ECEDF1',
      marginBottom: 10, overflow: 'hidden',
    },
    panelOff: { opacity: 0.35 },
    panelHead: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 16, minHeight: 58,
    },
    panelDot: { width: 10, height: 10, borderRadius: 5 },
    panelName: { fontSize: 16, fontWeight: '600', color: '#1A1D26', flex: 1, letterSpacing: -0.3 },
    panelBadge: {
      fontSize: 12, color: '#9498A8', fontWeight: '500',
      backgroundColor: '#F4F5F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    panelBody: { paddingHorizontal: 18, paddingBottom: 18 },

    // Chips
    chips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    chip: {
      paddingHorizontal: 20, paddingVertical: 9, borderRadius: 24,
      borderWidth: 1.5, borderColor: '#ECEDF1', backgroundColor: '#fff',
    },
    chipOn: { backgroundColor: '#1A1D26', borderColor: '#1A1D26' },
    chipText: { fontSize: 13, fontWeight: '500', color: '#5E6272' },
    chipTextOn: { color: '#fff' },

    // Items
    item: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB',
      marginBottom: 6, minHeight: 50,
    },
    itemName: { fontSize: 14, fontWeight: '500', color: '#1A1D26', lineHeight: 20 },
    itemSub: { fontSize: 12, color: '#9498A8', marginTop: 2 },
    itemEdit: {
      width: 32, height: 32, borderRadius: 8, backgroundColor: '#EEF2FF',
      justifyContent: 'center', alignItems: 'center',
    },
    itemRemove: {
      width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2',
      justifyContent: 'center', alignItems: 'center',
    },

    // Add button
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5,
      borderColor: '#D4D7DF', borderStyle: 'dashed', marginTop: 4,
    },
    addBtnText: { fontSize: 13, fontWeight: '500', color: '#2E5BFF' },

    // Expand
    expandBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 4, padding: 10, borderRadius: 8, marginTop: 4,
    },
    expandBtnText: { fontSize: 13, fontWeight: '500', color: '#2E5BFF' },

    // Exam packages
    label: { fontSize: 11, fontWeight: '500', color: '#9498A8', letterSpacing: 0.6, marginBottom: 8 },
    pkgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    pkg: {
      width: '48%' as any, padding: 14, borderRadius: 12,
      borderWidth: 1.5, borderColor: '#ECEDF1', backgroundColor: '#fff',
    },
    pkgName: { fontSize: 13, fontWeight: '600', color: '#1A1D26' },
    pkgCount: { fontSize: 11, color: '#9498A8', marginTop: 2 },
    divider: { height: 1, backgroundColor: '#ECEDF1', marginVertical: 10 },

    // Fields
    fieldLabel: { fontSize: 12, fontWeight: '500', color: '#5E6272', marginBottom: 5 },
    refHint: { fontSize: 12, color: '#6B7280', marginBottom: 12, lineHeight: 18 },
    input: {
      borderWidth: 1.5, borderColor: '#ECEDF1', borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
      color: '#1A1D26', backgroundColor: '#fff', minHeight: 48,
    },
    textArea: {
      borderWidth: 1.5, borderColor: '#ECEDF1', borderRadius: 12,
      padding: 14, fontSize: 14, color: '#1A1D26', backgroundColor: '#fff',
      minHeight: 64, textAlignVertical: 'top', marginBottom: 10,
    },

    // Certificate specifics
    certRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-end' },
    stepper: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6',
      borderRadius: 12, borderWidth: 1.5, borderColor: '#ECEDF1', overflow: 'hidden', height: 48,
    },
    stepBtn: {
      width: 44, height: 48, justifyContent: 'center', alignItems: 'center',
    },
    stepBtnText: { fontSize: 18, color: '#5E6272' },
    stepVal: { fontSize: 18, fontWeight: '600', minWidth: 32, textAlign: 'center', color: '#1A1D26' },
    checkRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 14, backgroundColor: '#F9FAFB', borderRadius: 12, minHeight: 48,
    },
    checkbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D4D7DF',
      justifyContent: 'center', alignItems: 'center',
    },
    checkboxOn: { backgroundColor: '#2E5BFF', borderColor: '#2E5BFF' },
    checkText: { fontSize: 13, color: '#5E6272', flex: 1 },

    // Summary
    summary: {
      backgroundColor: '#ECFDF5', borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 14,
    },
    summaryTitle: { fontSize: 15, fontWeight: '600', color: '#065F46', marginBottom: 10, letterSpacing: -0.3 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: '#D1FAE5' },
    tagText: { fontSize: 12, fontWeight: '500', color: '#065F46' },

    // CTAs
    signBtn: {
      backgroundColor: '#1A1D26', borderRadius: 16, paddingVertical: 18,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    signBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
    wppBtn: {
      borderRadius: 16, paddingVertical: 16, marginTop: 8,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      borderWidth: 1.5, borderColor: '#22C55E', backgroundColor: '#F7FDF9',
    },
    wppBtnText: { fontSize: 14, fontWeight: '500', color: '#166534' },
    footer: { fontSize: 11, color: '#9498A8', textAlign: 'center', marginTop: 12, lineHeight: 18 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalKav: { flex: 1, justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 34,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1D26', marginBottom: 16 },
    modalActs: { flexDirection: 'row', gap: 12, marginTop: 20 },
    modalBtnSec: {
      flex: 1, height: 48, borderRadius: 12, backgroundColor: '#F4F5F7',
      justifyContent: 'center', alignItems: 'center',
    },
    modalBtnSecText: { fontSize: 14, fontWeight: '600', color: '#5E6272' },
    modalBtnPri: {
      flex: 1, height: 48, borderRadius: 12, backgroundColor: '#2E5BFF',
      justifyContent: 'center', alignItems: 'center',
    },
    modalBtnPriText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
}
