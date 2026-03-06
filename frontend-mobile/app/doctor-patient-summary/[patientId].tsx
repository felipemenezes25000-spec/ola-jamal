/**
 * Resumo Clínico — Visão completa e organizada do prontuário do paciente.
 *
 * Dados do paciente, histórico narrativo, consultas com anamnese estruturada,
 * receitas, exames e insights da Dra. Renoveja.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { spacing, borderRadius, typography, doctorDS } from '../../lib/themeDoctor';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { getPatientRequests, getPatientProfileForDoctor, getPatientClinicalSummary, addDoctorPatientNote, DOCTOR_NOTE_TYPES, sortRequestsByNewestFirst, type DoctorNoteDto } from '../../lib/api';
import type { PatientClinicalSummaryStructured } from '../../lib/api';
import type { RequestResponseDto, PatientProfileForDoctorDto } from '../../types/database';
import { DoctorHeader } from '../../components/ui/DoctorHeader';
import { AppEmptyState, AppButton, FormSection } from '../../components/ui';
import { useTriageEval } from '../../hooks/useTriageEval';
import { showToast } from '../../components/ui/Toast';
import { formatDateTimeBR, formatDateBR } from '../../lib/utils/format';

// ── Anamnese fields (alinhado com consultation-summary) ──

function fmtDateTime(d: string): string {
  return formatDateTimeBR(d);
}

function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate()))
    age--;
  return age >= 0 ? age : null;
}

function fmtBirthDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatAddress(p: PatientProfileForDoctorDto): string {
  const parts: string[] = [];
  if (p.street) parts.push(p.street + (p.number ? `, ${p.number}` : ''));
  if (p.neighborhood) parts.push(p.neighborhood);
  if (p.city) parts.push(p.city + (p.state ? ` - ${p.state}` : ''));
  if (p.postalCode) parts.push(`CEP ${p.postalCode.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2')}`);
  return parts.filter(Boolean).join(' · ') || '—';
}

function extractCidFromAnamnesis(json: string | null | undefined): string | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json);
    const cid = obj?.cid_sugerido || obj?.cid || obj?.cidPrincipal;
    return typeof cid === 'string' && cid.trim().length > 0 ? cid.trim() : null;
  } catch {
    return null;
  }
}

function extractAllergiesFromAnamnesis(json: string | null | undefined): string | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json);
    const a = obj?.alergias;
    if (Array.isArray(a) && a.length > 0) return a.join(', ');
    return typeof a === 'string' && a.trim().length > 0 ? a.trim() : null;
  } catch {
    return null;
  }
}

export default function DoctorPatientClinicalSummary() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const id = Array.isArray(patientId) ? patientId[0] : patientId ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ANA_FIELDS = useMemo(() => [
    { key: 'queixa_principal', label: 'Queixa Principal', icon: 'chatbubble-ellipses' as const, color: colors.primary },
    { key: 'historia_doenca_atual', label: 'História da Doença Atual', icon: 'time' as const, color: colors.primary },
    { key: 'sintomas', label: 'Sintomas', icon: 'thermometer' as const, color: colors.warning },
    { key: 'medicamentos_em_uso', label: 'Medicamentos em Uso', icon: 'medical' as const, color: colors.primaryLight },
    { key: 'alergias', label: 'Alergias', icon: 'warning' as const, color: colors.error },
    { key: 'antecedentes_relevantes', label: 'Antecedentes', icon: 'document-text' as const, color: colors.textMuted },
    { key: 'cid_sugerido', label: 'CID Sugerido', icon: 'code-slash' as const, color: colors.success },
    { key: 'outros', label: 'Outras Informações', icon: 'ellipsis-horizontal' as const, color: colors.textMuted },
  ], [colors]);

  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [profile, setProfile] = useState<PatientProfileForDoctorDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedConsultation, setExpandedConsultation] = useState<string | null>(null);
  const [expandedPrescription, setExpandedPrescription] = useState<string | null>(null);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [structured, setStructured] = useState<PatientClinicalSummaryStructured | null>(null);
  const [doctorNotes, setDoctorNotes] = useState<DoctorNoteDto[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteType, setNewNoteType] = useState<string>('progress_note');
  const [linkedRequestId, setLinkedRequestId] = useState<string | null>(null);
  const [addingNote, setAddingNote] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [data, prof] = await Promise.all([
        getPatientRequests(id),
        getPatientProfileForDoctor(id),
      ]);
      setRequests(data);
      setProfile(prof);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setSummaryLoading(true);
    setSummary(null);
    setStructured(null);
    getPatientClinicalSummary(id)
      .then((res) => {
        if (!cancelled) {
          setSummary(res.summary || res.fallback || null);
          setStructured(res.structured ?? null);
          setDoctorNotes(res.doctorNotes ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
        if (!cancelled) setStructured(null);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, summaryRefreshKey]);

  const handleAddNote = useCallback(async () => {
    if (!id || !newNoteContent.trim()) return;
    setAddingNote(true);
    try {
      const note = await addDoctorPatientNote(id, {
        noteType: newNoteType,
        content: newNoteContent.trim(),
        requestId: linkedRequestId,
      });
      setDoctorNotes((prev) => [note, ...prev]);
      setNewNoteContent('');
      setLinkedRequestId(null);
      showToast({ message: 'Nota registrada', type: 'success' });
    } catch (e) {
      console.error(e);
      showToast({ message: 'Não foi possível registrar a nota', type: 'error' });
    } finally {
      setAddingNote(false);
    }
  }, [id, newNoteContent, newNoteType, linkedRequestId]);

  const getNoteTypeLabel = (key: string) => DOCTOR_NOTE_TYPES.find((t) => t.key === key)?.label ?? key;
  const getNoteTypeIcon = (key: string) => DOCTOR_NOTE_TYPES.find((t) => t.key === key)?.icon ?? 'document-text';

  const onRefresh = () => {
    setRefreshing(true);
    setSummaryRefreshKey((k) => k + 1);
    loadData();
  };

  const sortedRequests = useMemo(() => sortRequestsByNewestFirst(requests), [requests]);

  const consultations = useMemo(
    () =>
      sortedRequests
        .filter((r) => r.requestType === 'consultation')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [sortedRequests]
  );

  const prescriptions = useMemo(
    () => sortedRequests.filter((r) => r.requestType === 'prescription'),
    [sortedRequests]
  );

  const exams = useMemo(
    () => sortedRequests.filter((r) => r.requestType === 'exam'),
    [sortedRequests]
  );

  const patientName = profile?.name ?? sortedRequests[0]?.patientName ?? 'Paciente';

  // Agregar alergias de todas as anamneses (evitar duplicatas)
  const allAllergies = useMemo(() => {
    const set = new Set<string>();
    consultations.forEach((c) => {
      const a = extractAllergiesFromAnamnesis(c.consultationAnamnesis);
      if (a) a.split(/[,;]/).map((x) => x.trim()).filter(Boolean).forEach((x) => set.add(x));
    });
    return Array.from(set);
  }, [consultations]);

  // Dra. Renoveja — estatísticas para insights
  const totalRequests = requests.length;
  const last6Months = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return requests.filter((r) => new Date(r.createdAt) >= cutoff);
  }, [requests]);
  const recentPrescriptionCount = useMemo(
    () => last6Months.filter((r) => r.requestType === 'prescription').length,
    [last6Months]
  );
  const recentExamCount = useMemo(
    () => last6Months.filter((r) => r.requestType === 'exam').length,
    [last6Months]
  );
  const lastConsultationDays = useMemo(() => {
    if (consultations.length === 0) return undefined;
    const latest = consultations[consultations.length - 1];
    return Math.floor(
      (Date.now() - new Date(latest.createdAt).getTime()) / (24 * 60 * 60 * 1000)
    );
  }, [consultations]);

  useTriageEval({
    context: 'doctor_prontuario',
    step: 'idle',
    role: 'doctor',
    totalRequests,
    recentPrescriptionCount,
    recentExamCount,
    lastConsultationDays,
  });

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <DoctorHeader
        title="Resumo clínico"
        subtitle={patientName}
        onBack={() => router.back()}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: listPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Identificação do paciente (dados cadastrais completos) ── */}
        <FormSection
          title="Identificação do paciente"
          subtitle="Dados cadastrais e histórico resumido"
          style={styles.formSection}
          contentStyle={styles.formSectionContent}
        >
          <View style={styles.patientGrid}>
            <View style={styles.patientRow}>
              <Text style={styles.patientLabel}>Nome completo</Text>
              <Text style={styles.patientValue}>{patientName}</Text>
            </View>
            {profile && (
              <View style={styles.patientRow}>
                <Text style={styles.patientLabel}>Data de nascimento</Text>
                <Text style={styles.patientValue}>
                  {fmtBirthDate(profile.birthDate)}
                  {calcAge(profile.birthDate) != null && (
                    <Text style={styles.patientAge}> · {calcAge(profile.birthDate)} anos</Text>
                  )}
                </Text>
              </View>
            )}
            {profile?.cpfMasked && (
              <View style={styles.patientRow}>
                <Text style={styles.patientLabel}>CPF</Text>
                <Text style={styles.patientValue}>{profile.cpfMasked}</Text>
              </View>
            )}
            {profile?.gender && (
              <View style={styles.patientRow}>
                <Text style={styles.patientLabel}>Sexo</Text>
                <Text style={styles.patientValue}>
                  {profile.gender === 'M' ? 'Masculino' : profile.gender === 'F' ? 'Feminino' : profile.gender}
                </Text>
              </View>
            )}
            {profile?.phone && (
              <View style={styles.patientRow}>
                <Text style={styles.patientLabel}>Telefone</Text>
                <Text style={styles.patientValue}>{profile.phone}</Text>
              </View>
            )}
            {profile?.email && (
              <View style={styles.patientRow}>
                <Text style={styles.patientLabel}>E-mail</Text>
                <Text style={styles.patientValue}>{profile.email}</Text>
              </View>
            )}
            {(profile?.street || profile?.city) && (
              <View style={styles.patientRow}>
                <Text style={styles.patientLabel}>Endereço</Text>
                <Text style={styles.patientValue}>{formatAddress(profile!)}</Text>
              </View>
            )}
          </View>
          <View style={styles.patientStatsRow}>
            <Text style={styles.patientStats}>
              {consultations.length} consulta(s) · {prescriptions.length} receita(s) · {exams.length} exame(s)
            </Text>
          </View>
          {allAllergies.length > 0 && (
            <View style={styles.allergyBlock}>
              <View style={styles.allergyLabel}>
                <Ionicons name="warning" size={14} color={colors.error} />
                <Text style={styles.allergyLabelText}>ALERGIAS REGISTRADAS</Text>
              </View>
              <Text style={styles.allergyValue}>{allAllergies.join(' · ')}</Text>
            </View>
          )}
        </FormSection>

        {/* ── Notas clínicas do médico (FHIR/Epic-inspired) ── */}
        <View style={styles.doctorNotesSection}>
          <View style={styles.doctorNotesSectionHeader}>
            <View style={[styles.doctorNotesSectionIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="journal" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorNotesSectionTitle}>Notas clínicas</Text>
              <Text style={styles.doctorNotesSectionSub}>Evolução, impressão diagnóstica, complementos e observações</Text>
            </View>
          </View>

          {/* Formulário: nova nota */}
          <View style={styles.doctorNotesForm}>
            <Text style={styles.doctorNotesFormLabel}>Tipo da nota</Text>
            <View style={styles.noteTypeChips}>
              {DOCTOR_NOTE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.noteTypeChip, newNoteType === t.key && styles.noteTypeChipActive]}
                  onPress={() => setNewNoteType(t.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={t.icon as any} size={14} color={newNoteType === t.key ? colors.white : colors.primary} />
                  <Text style={[styles.noteTypeChipText, newNoteType === t.key && styles.noteTypeChipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.doctorNotesFormLabel}>Conteúdo</Text>
            <TextInput
              style={styles.doctorNotesInput}
              placeholder="Ex: Opto por associar medicação X ao esquema atual..."
              placeholderTextColor={colors.textMuted}
              value={newNoteContent}
              onChangeText={setNewNoteContent}
              multiline
              textAlignVertical="top"
            />
            {sortedRequests.length > 0 && (
              <>
                <Text style={styles.doctorNotesFormLabel}>Vincular a atendimento (opcional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.requestLinkScroll}>
                  <TouchableOpacity
                    style={[styles.requestLinkChip, !linkedRequestId && styles.requestLinkChipActive]}
                    onPress={() => setLinkedRequestId(null)}
                  >
                    <Text style={[styles.requestLinkChipText, !linkedRequestId && styles.requestLinkChipTextActive]}>Nenhum</Text>
                  </TouchableOpacity>
                  {sortedRequests.slice(0, 8).map((r) => {
                    const typeLabel = r.requestType === 'consultation' ? 'Consulta' : r.requestType === 'prescription' ? 'Receita' : 'Exame';
                    const isSelected = linkedRequestId === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.requestLinkChip, isSelected && styles.requestLinkChipActive]}
                        onPress={() => setLinkedRequestId(isSelected ? null : r.id)}
                      >
                        <Text style={[styles.requestLinkChipText, isSelected && styles.requestLinkChipTextActive]} numberOfLines={1}>
                          {typeLabel} · {formatDateBR(r.createdAt, { short: true })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
            <AppButton
              title="Registrar nota"
              variant="doctorPrimary"
              onPress={handleAddNote}
              loading={addingNote}
              disabled={!newNoteContent.trim()}
              style={styles.doctorNotesAddBtn}
            />
          </View>

          {/* Timeline de notas */}
          {doctorNotes.length > 0 ? (
            <View style={styles.doctorNotesTimeline}>
              <Text style={styles.doctorNotesTimelineTitle}>Histórico ({doctorNotes.length})</Text>
              {doctorNotes.map((note, idx) => (
                <View key={note.id} style={[styles.noteCard, idx < doctorNotes.length - 1 && styles.noteCardBorder]}>
                  <View style={styles.noteCardHeader}>
                    <View style={[styles.noteCardTypeBadge, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name={getNoteTypeIcon(note.noteType) as any} size={12} color={colors.primary} />
                      <Text style={styles.noteCardTypeText}>{getNoteTypeLabel(note.noteType)}</Text>
                    </View>
                    <Text style={styles.noteCardDate}>{formatDateTimeBR(note.createdAt)}</Text>
                  </View>
                  <Text style={styles.noteCardContent}>{note.content}</Text>
                  {note.requestId && (
                    <TouchableOpacity
                      style={styles.noteCardLink}
                      onPress={() => router.push(`/doctor-request/${note.requestId}` as never)}
                    >
                      <Ionicons name="open-outline" size={12} color={colors.primary} />
                      <Text style={styles.noteCardLinkText}>Ver atendimento vinculado</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.doctorNotesEmpty}>
              <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
              <Text style={styles.doctorNotesEmptyText}>Nenhuma nota registrada</Text>
              <Text style={styles.doctorNotesEmptySub}>Use o formulário acima para adicionar evolução, impressão diagnóstica ou observações.</Text>
            </View>
          )}
        </View>

        {/* ── Alertas (IA + alergias) — destaque no topo ── */}
        {requests.length > 0 && (structured?.alerts?.length ?? 0) + allAllergies.length > 0 && (
          <View style={styles.alertsCard}>
            <View style={styles.alertsHeader}>
              <Ionicons name="warning" size={20} color={colors.error} />
              <Text style={styles.alertsTitle}>Pontos de atenção</Text>
            </View>
            <View style={styles.alertsList}>
              {allAllergies.map((a, i) => (
                <View key={`allergy-${i}`} style={styles.alertItem}>
                  <Ionicons name="medical" size={14} color={colors.error} />
                  <Text style={styles.alertsItemText}>Alergia: {a}</Text>
                </View>
              ))}
              {structured?.alerts?.map((a, i) => (
                <View key={`alert-${i}`} style={styles.alertItem}>
                  <Ionicons name="alert-circle" size={14} color={colors.warning} />
                  <Text style={styles.alertsItemText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Lista de Problemas (estilo Epic/Cerner) ── */}
        {structured?.problemList && structured.problemList.length > 0 && (
          <View style={styles.structuredCard}>
            <View style={styles.structuredHeader}>
              <View style={[styles.structuredIcon, { backgroundColor: colors.infoLight }]}>
                <Ionicons name="list" size={18} color={colors.info} />
              </View>
              <Text style={styles.structuredTitle}>Lista de problemas</Text>
            </View>
            <View style={styles.chipList}>
              {structured.problemList.map((p, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Medicamentos em uso (reconciliação) ── */}
        {structured?.activeMedications && structured.activeMedications.length > 0 && (
          <View style={styles.structuredCard}>
            <View style={styles.structuredHeader}>
              <View style={[styles.structuredIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="medical" size={18} color={colors.primary} />
              </View>
              <Text style={styles.structuredTitle}>Medicamentos em uso</Text>
            </View>
            {structured.activeMedications.map((m, i) => (
              <View key={i} style={styles.medItem}>
                <View style={styles.medBullet}><Text style={styles.medBulletText}>{i + 1}</Text></View>
                <Text style={styles.medText}>{m}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Plano de cuidado ── */}
        {typeof structured?.carePlan === 'string' && structured.carePlan.trim().length > 0 && (
          <View style={styles.structuredCard}>
            <View style={styles.structuredHeader}>
              <View style={[styles.structuredIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="clipboard" size={18} color={colors.success} />
              </View>
              <Text style={styles.structuredTitle}>Plano de cuidado</Text>
            </View>
            <Text style={styles.structuredBody}>{structured.carePlan}</Text>
          </View>
        )}

        {/* ── Resumo narrativo (IA) ── */}
        {requests.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIconWrap}>
                <Ionicons name="document-text" size={22} color={colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>Resumo narrativo</Text>
                <Text style={styles.summarySub}>Visão consolidada · consultas, receitas e exames</Text>
              </View>
            </View>
            {summaryLoading ? (
              <View style={styles.summaryLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.summaryLoadingText}>Gerando resumo...</Text>
              </View>
            ) : (structured?.narrativeSummary ?? summary) ? (
              <Text style={styles.summaryText}>{structured?.narrativeSummary ?? summary}</Text>
            ) : (
              <Text style={styles.summaryEmpty}>
                Resumo indisponível. Use os detalhes abaixo para revisar o histórico.
              </Text>
            )}
            <Text style={styles.summaryDisclaimer}>
              Resumo de apoio. O médico decide com base na avaliação clínica.
            </Text>
          </View>
        )}

        {/* ── Dra. Renoveja — Insights ── */}
        <View style={styles.draRenovaCard}>
          <View style={styles.draRenovaHeader}>
            <View style={[styles.draRenovaAvatar, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.draRenovaLabel}>Dra. Renoveja</Text>
              <Text style={styles.draRenovaSub}>Insights e sugestões de apoio</Text>
            </View>
          </View>
          <View style={styles.draRenovaContent}>
            {consultations.length === 0 ? (
              <Text style={styles.draRenovaText}>
                Este paciente ainda não realizou consultas. Quando houver histórico, posso sugerir pontos de atenção e evolução.
              </Text>
            ) : (
              <>
                <Text style={styles.draRenovaText}>
                  Histórico com {consultations.length} consulta(s). Use a anamnese estruturada abaixo para visão contínua: queixa, evolução, CID e conduta.
                </Text>
                {allAllergies.length > 0 && (
                  <View style={styles.draRenovaAlert}>
                    <Ionicons name="alert-circle" size={14} color={colors.error} />
                    <Text style={styles.draRenovaAlertText}>
                      Atenção: alergias registradas — {allAllergies.slice(0, 2).join(', ')}{allAllergies.length > 2 ? '...' : ''}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
          <Text style={styles.draRenovaDisclaimer}>
            Orientação geral · Decisão clínica sempre do médico
          </Text>
        </View>

        {/* ── Detalhes por tipo (colapsável) ── */}
        <Pressable
          style={styles.detailsToggle}
          onPress={() => setShowDetails((v) => !v)}
        >
          <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
          <Text style={styles.detailsToggleText}>
            {showDetails ? 'Ocultar detalhes' : `Ver detalhes (${prescriptions.length} receitas · ${exams.length} exames · ${consultations.length} consultas)`}
          </Text>
        </Pressable>

        {showDetails && (
        <>
        {/* ── Histórico completo (tudo que o paciente fez no app) ── */}
        <View style={styles.introCard}>
          <Ionicons name="layers" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Histórico completo</Text>
            <Text style={styles.introText}>
              Tudo que o paciente solicitou e escreveu no app: receitas, exames, consultas — com medicamentos, queixas, análises da IA e condutas.
            </Text>
          </View>
        </View>

        {/* ── Receitas (conteúdo completo) ── */}
        {prescriptions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Receitas</Text>
            {prescriptions.map((r, idx) => {
              const isExp = expandedPrescription === r.id;
              const meds = r.medications ?? [];
              const typeLabel = r.prescriptionType === 'controlado' ? 'Controlada' : r.prescriptionType === 'azul' ? 'Azul' : 'Simples';
              return (
                <View key={r.id} style={styles.entryCard}>
                  <Pressable
                    style={styles.entryHeader}
                    onPress={() => setExpandedPrescription(isExp ? null : r.id)}
                  >
                    <View style={[styles.entryIconWrap, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="document-text" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle}>Receita {idx + 1} · {typeLabel}</Text>
                      <Text style={styles.entryDate}>{fmtDateTime(r.createdAt)}</Text>
                    </View>
                    <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
                  </Pressable>
                  {meds.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Medicamentos</Text>
                      <Text style={styles.fieldValue}>{meds.join(', ')}</Text>
                    </View>
                  )}
                  {isExp && (
                    <>
                      {r.notes && (
                        <View style={styles.fieldBlock}>
                          <Text style={styles.fieldLabel}>Observações</Text>
                          <Text style={styles.fieldValue}>{r.notes}</Text>
                        </View>
                      )}
                      {r.aiSummaryForDoctor && (
                        <View style={styles.fieldBlock}>
                          <Text style={styles.fieldLabel}>Análise da IA</Text>
                          <Text style={[styles.fieldValue, { color: colors.textSecondary }]}>{r.aiSummaryForDoctor}</Text>
                        </View>
                      )}
                      {(r.aiRiskLevel || r.aiUrgency) && (
                        <View style={styles.fieldBlock}>
                          <Text style={styles.fieldLabel}>Risco / Urgência</Text>
                          <Text style={styles.fieldValue}>{[r.aiRiskLevel, r.aiUrgency].filter(Boolean).join(' · ')}</Text>
                        </View>
                      )}
                      <TouchableOpacity style={styles.detailLink} onPress={() => router.push(`/doctor-request/${r.id}` as never)}>
                        <Text style={styles.detailLinkText}>Ver pedido completo</Text>
                        <Ionicons name="open-outline" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ── Exames (conteúdo completo) ── */}
        {exams.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Exames</Text>
            {exams.map((r, idx) => {
              const isExp = expandedExam === r.id;
              const exList = r.exams ?? [];
              return (
                <View key={r.id} style={styles.entryCard}>
                  <Pressable
                    style={styles.entryHeader}
                    onPress={() => setExpandedExam(isExp ? null : r.id)}
                  >
                    <View style={[styles.entryIconWrap, { backgroundColor: colors.infoLight }]}>
                      <Ionicons name="flask" size={18} color={colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle}>Exame {idx + 1}{r.examType ? ` · ${r.examType}` : ''}</Text>
                      <Text style={styles.entryDate}>{fmtDateTime(r.createdAt)}</Text>
                    </View>
                    <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
                  </Pressable>
                  {exList.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Exames solicitados</Text>
                      <Text style={styles.fieldValue}>{exList.join(', ')}</Text>
                    </View>
                  )}
                  {isExp && (
                    <>
                      {r.symptoms && (
                        <View style={styles.fieldBlock}>
                          <Text style={styles.fieldLabel}>Queixa / Sintomas</Text>
                          <Text style={styles.fieldValue}>{r.symptoms}</Text>
                        </View>
                      )}
                      {r.notes && (
                        <View style={styles.fieldBlock}>
                          <Text style={styles.fieldLabel}>Observações</Text>
                          <Text style={styles.fieldValue}>{r.notes}</Text>
                        </View>
                      )}
                      {r.aiSummaryForDoctor && (
                        <View style={styles.fieldBlock}>
                          <Text style={styles.fieldLabel}>Análise da IA</Text>
                          <Text style={[styles.fieldValue, { color: colors.textSecondary }]}>{r.aiSummaryForDoctor}</Text>
                        </View>
                      )}
                      <TouchableOpacity style={styles.detailLink} onPress={() => router.push(`/doctor-request/${r.id}` as never)}>
                        <Text style={styles.detailLinkText}>Ver pedido completo</Text>
                        <Ionicons name="open-outline" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ── Consultas com anamnese completa ── */}
        {consultations.length === 0 && prescriptions.length === 0 && exams.length === 0 && (
          <AppEmptyState
            icon="document-text-outline"
            title="Nenhum registro encontrado"
            subtitle="Quando este paciente fizer solicitações (receitas, exames ou consultas), o histórico aparecerá aqui."
          />
        )}

        {consultations.length > 0 && <Text style={styles.sectionTitle}>Consultas</Text>}

        {consultations.map((c, idx) => {
          const isExpanded = expandedConsultation === c.id;
          const anamnesis = (() => {
            if (!c.consultationAnamnesis) return null;
            try {
              return JSON.parse(c.consultationAnamnesis);
            } catch {
              return null;
            }
          })();
          const suggestions = (() => {
            if (!c.consultationAiSuggestions) return [];
            try {
              const p = JSON.parse(c.consultationAiSuggestions);
              return Array.isArray(p) ? p : [];
            } catch {
              return [];
            }
          })();
          const hasAnamnesis = anamnesis && Object.keys(anamnesis).length > 0;
          const hasSuggestions = suggestions.length > 0;
          const hasTranscript = !!(c.consultationTranscript && c.consultationTranscript.trim());

          return (
            <View key={c.id} style={styles.entryCard}>
              <Pressable
                style={styles.entryHeader}
                onPress={() => setExpandedConsultation(isExpanded ? null : c.id)}
              >
                <View style={[styles.entryIconWrap, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="videocam" size={18} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryTitle}>Consulta {idx + 1}</Text>
                  <Text style={styles.entryDate}>{fmtDateTime(c.createdAt)}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>

              {c.symptoms && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Queixa e duração (paciente)</Text>
                  <Text style={styles.fieldValue}>{c.symptoms}</Text>
                </View>
              )}

              {extractCidFromAnamnesis(c.consultationAnamnesis) && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Hipótese diagnóstica (CID)</Text>
                  <Text style={styles.fieldValue}>{extractCidFromAnamnesis(c.consultationAnamnesis)}</Text>
                </View>
              )}

              {(c.doctorConductNotes || c.aiConductSuggestion) && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    {c.doctorConductNotes ? 'Registro do médico (prontuário)' : 'Sugestão de conduta da IA'}
                  </Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      !c.doctorConductNotes && { color: colors.textSecondary, fontStyle: 'italic' },
                    ]}
                  >
                    {c.doctorConductNotes || c.aiConductSuggestion}
                  </Text>
                  {c.doctorConductNotes && c.conductUpdatedAt && (
                    <Text style={styles.fieldMeta}>
                      Editado em {fmtDateTime(c.conductUpdatedAt)}
                    </Text>
                  )}
                </View>
              )}

              {isExpanded && (
                <>
                  {/* Anamnese estruturada completa */}
                  {hasAnamnesis && (
                    <View style={styles.anamnesisBlock}>
                      <Text style={styles.anamnesisTitle}>Anamnese estruturada</Text>
                      {ANA_FIELDS.map(({ key, label, icon, color }) => {
                        const val = anamnesis[key];
                        if (!val || (typeof val === 'string' && !val.trim())) return null;
                        const display = Array.isArray(val) ? val.join(', ') : String(val);
                        const isAlert = key === 'alergias';
                        return (
                          <View key={key} style={styles.anaField}>
                            <View style={[styles.anaFieldIcon, { backgroundColor: `${color}20` }]}>
                              <Ionicons name={icon} size={12} color={color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.anaFieldLabel, isAlert && { color: colors.error }]}>{label}</Text>
                              <Text style={styles.anaFieldValue}>{display}</Text>
                            </View>
                          </View>
                        );
                      })}
                      {Array.isArray(anamnesis.alertas_vermelhos) && anamnesis.alertas_vermelhos.length > 0 && (
                        <View style={styles.alertBlock}>
                          <Text style={styles.alertLabel}>⚠️ ALERTAS</Text>
                          {(anamnesis.alertas_vermelhos as string[]).map((a: string, i: number) => (
                            <Text key={i} style={styles.alertText}>{a}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Sugestões IA */}
                  {hasSuggestions && (
                    <View style={styles.suggestionsBlock}>
                      <Text style={styles.suggestionsTitle}>Sugestões clínicas da IA</Text>
                      {suggestions.map((s: string, i: number) => {
                        const str = typeof s === 'string' ? s : '';
                        const isRed = str.startsWith('🚨');
                        return (
                          <View key={i} style={[styles.suggestionItem, isRed && styles.suggestionDanger]}>
                            <Ionicons
                              name={isRed ? 'alert-circle' : 'bulb-outline'}
                              size={14}
                              color={isRed ? colors.error : colors.primaryLight}
                            />
                            <Text style={[styles.suggestionText, isRed && { color: colors.error }]}>
                              {str.replace('🚨 ', '')}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Transcrição */}
                  {hasTranscript && (
                    <View style={styles.transcriptBlock}>
                      <View style={styles.transcriptHeader}>
                        <Text style={styles.transcriptTitle}>Transcrição</Text>
                        <TouchableOpacity
                          onPress={async () => {
                            await Clipboard.setStringAsync(c.consultationTranscript || '');
                            showToast({ message: 'Transcrição copiada', type: 'success' });
                          }}
                        >
                          <Ionicons name="copy-outline" size={16} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.transcriptText} numberOfLines={6}>
                        {c.consultationTranscript}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.detailLink}
                    onPress={() => router.push(`/doctor-request/${c.id}` as never)}
                  >
                    <Text style={styles.detailLinkText}>Ver detalhes da consulta</Text>
                    <Ionicons name="open-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })}
        </>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: doctorDS.screenPaddingHorizontal,
    gap: spacing.md,
  },
  formSection: { marginHorizontal: -doctorDS.screenPaddingHorizontal, marginTop: 0 },
  formSectionContent: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },

  patientCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  patientSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  patientSectionTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.text,
  },
  patientGrid: { gap: spacing.sm },
  patientRow: { gap: 2 },
  patientLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  patientValue: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    lineHeight: 21,
  },
  patientAge: { color: colors.textSecondary, fontWeight: '500' },
  patientStatsRow: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  patientStats: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  allergyBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  allergyLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  allergyLabelText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.error,
    letterSpacing: 0.5,
  },
  allergyValue: { fontSize: 13, color: colors.text, lineHeight: 20 },

  doctorNotesSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    overflow: 'hidden',
  },
  doctorNotesSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  doctorNotesSectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorNotesSectionTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.text,
  },
  doctorNotesSectionSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  doctorNotesForm: { marginBottom: spacing.lg },
  doctorNotesFormLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    letterSpacing: 0.5,
  },
  noteTypeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  noteTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  noteTypeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  noteTypeChipText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  noteTypeChipTextActive: { color: colors.white },
  doctorNotesInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: typography.fontFamily.regular,
  },
  requestLinkScroll: { marginBottom: spacing.sm, marginTop: spacing.xs },
  requestLinkChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceSecondary,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestLinkChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  requestLinkChipText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  requestLinkChipTextActive: { color: colors.primary },
  doctorNotesAddBtn: { marginTop: spacing.md, alignSelf: 'flex-start' },
  doctorNotesTimeline: { marginTop: spacing.md, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  doctorNotesTimelineTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.textMuted,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  noteCard: { paddingVertical: spacing.md },
  noteCardBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  noteCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, flexWrap: 'wrap', gap: 4 },
  noteCardTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    alignSelf: 'flex-start',
  },
  noteCardTypeText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  noteCardDate: { fontSize: 11, color: colors.textMuted },
  noteCardContent: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    lineHeight: 22,
  },
  noteCardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  noteCardLinkText: { fontSize: 12, fontFamily: typography.fontFamily.semibold, color: colors.primary },
  doctorNotesEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  doctorNotesEmptyText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textMuted,
  },
  doctorNotesEmptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  alertsCard: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  alertsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  alertsTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 0.5,
  },
  alertsList: { gap: spacing.xs },
  alertItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  alertsItemText: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.text, flex: 1 },

  structuredCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
  },
  structuredHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  structuredIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  structuredTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.text,
  },
  structuredBody: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  chipText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  medItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: 10 },
  medBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medBulletText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  medText: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, flex: 1, lineHeight: 21 },

  draRenovaCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primaryLight,
  },
  draRenovaHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  draRenovaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draRenovaLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  draRenovaSub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  draRenovaContent: { marginTop: spacing.md },
  draRenovaText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  draRenovaAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.sm,
  },
  draRenovaAlertText: { fontSize: 12, color: colors.error, fontWeight: '600' },
  draRenovaDisclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primaryLight,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  summaryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139,92,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.text,
  },
  summarySub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  summaryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  summaryLoadingText: { fontSize: 14, color: colors.textSecondary },
  summaryText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    lineHeight: 22,
  },
  summaryEmpty: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  summaryDisclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  detailsToggleText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },

  introCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  introTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  introText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  entryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.text,
  },
  entryDate: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  fieldBlock: { marginTop: spacing.xs },
  fieldLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    lineHeight: 21,
  },
  fieldMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },

  anamnesisBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  anamnesisTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  anaField: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  anaFieldIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anaFieldLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  anaFieldValue: { fontSize: 13, color: colors.text, lineHeight: 20, flex: 1 },

  alertBlock: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  alertLabel: { fontSize: 12, fontWeight: '700', color: colors.error, marginBottom: 4 },
  alertText: { fontSize: 12, color: colors.destructive, lineHeight: 18 },

  suggestionsBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.primaryLight,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  suggestionDanger: { backgroundColor: colors.errorLight, borderRadius: 8, padding: 8 },
  suggestionText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, flex: 1 },

  transcriptBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  transcriptTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  transcriptText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailLinkText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },

  sectionTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  });
}
