/**
 * Prontuário Unificado do Paciente — Tela com abas.
 *
 * Visão Geral | Consultas | Documentos | Notas Clínicas
 *
 * Substitui as antigas telas doctor-patient e doctor-patient-summary
 * em uma única experiência organizada e eficiente para o médico.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { spacing } from '../../lib/themeDoctor';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { useListBottomPadding } from '../../lib/ui/responsive';
import {
  getPatientRequests,
  getPatientProfileForDoctor,
  getPatientClinicalSummary,
  sortRequestsByNewestFirst,
  type DoctorNoteDto,
  type PatientClinicalSummaryStructured,
} from '../../lib/api';
import type { RequestResponseDto, PatientProfileForDoctorDto } from '../../types/database';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { AppSegmentedControl, AppEmptyState } from '../../components/ui';
import { useTriageEval } from '../../hooks/useTriageEval';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';
import { extractAllergiesFromJson } from '../../lib/domain/anamnesis';

import { PatientIdentityCard } from '../../components/prontuario/PatientIdentityCard';
import { AlertsBanner } from '../../components/prontuario/AlertsBanner';
import { ClinicalOverviewTab } from '../../components/prontuario/ClinicalOverviewTab';
import { ConsultationsTab } from '../../components/prontuario/ConsultationsTab';
import { DocumentsTab } from '../../components/prontuario/DocumentsTab';
import { ClinicalNotesTab } from '../../components/prontuario/ClinicalNotesTab';

const TAB_ITEMS = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'consultations', label: 'Consultas' },
  { key: 'documents', label: 'Documentos' },
  { key: 'notes', label: 'Notas' },
] as const;

type TabKey = (typeof TAB_ITEMS)[number]['key'];

export default function DoctorPatientProntuario() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const id = Array.isArray(patientId) ? patientId[0] : patientId ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { colors, gradients } = useAppTheme({ role: 'doctor' });
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ── State ──
  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [profile, setProfile] = useState<PatientProfileForDoctorDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const [summary, setSummary] = useState<string | null>(null);
  const [structured, setStructured] = useState<PatientClinicalSummaryStructured | null>(null);
  const [doctorNotes, setDoctorNotes] = useState<DoctorNoteDto[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  // ── Data loading ──
  const loadData = useCallback(async (withFeedback = false) => {
    if (!id) return;
    try {
      setLoadError(false);
      const [data, prof] = await Promise.all([
        getPatientRequests(id),
        getPatientProfileForDoctor(id),
      ]);
      setRequests(data);
      setProfile(prof);
      if (withFeedback) showToast({ message: 'Prontuário atualizado', type: 'success' });
    } catch {
      setLoadError(true);
      if (withFeedback) showToast({ message: 'Não foi possível atualizar', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

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
        if (!cancelled) { setSummary(null); setStructured(null); }
      })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [id, summaryRefreshKey]);

  const onRefresh = () => {
    haptics.light();
    setRefreshing(true);
    setSummaryRefreshKey((k) => k + 1);
    loadData(true);
  };

  // ── Derived data ──
  const sortedRequests = useMemo(() => sortRequestsByNewestFirst(requests), [requests]);
  const patientName = profile?.name ?? sortedRequests[0]?.patientName ?? 'Paciente';

  const consultations = useMemo(
    () => sortedRequests
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

  const allAllergies = useMemo(() => {
    const set = new Set<string>();
    consultations.forEach((c) => {
      extractAllergiesFromJson(c.consultationAnamnesis).forEach((a) => set.add(a));
    });
    return Array.from(set);
  }, [consultations]);

  const lastConsultationDays = useMemo(() => {
    if (consultations.length === 0) return undefined;
    const latest = consultations[consultations.length - 1];
    return Math.floor(
      (Date.now() - new Date(latest.createdAt).getTime()) / (24 * 60 * 60 * 1000)
    );
  }, [consultations]);

  // ── Triage eval ──
  useTriageEval({
    context: 'doctor_prontuario',
    step: 'idle',
    role: 'doctor',
    totalRequests: requests.length,
    recentPrescriptionCount: useMemo(() => {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      return requests.filter((r) => r.requestType === 'prescription' && new Date(r.createdAt) >= cutoff).length;
    }, [requests]),
    recentExamCount: useMemo(() => {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      return requests.filter((r) => r.requestType === 'exam' && new Date(r.createdAt) >= cutoff).length;
    }, [requests]),
    lastConsultationDays,
  });

  // ── Loading state ──
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
      <CompactHeader title="Prontuário" subtitle={patientName} topInset={insets.top} onBack={() => router.back()} colors={colors} gradientColors={gradients.doctorHeader} />
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <SkeletonList count={5} />
        </View>
      </View>
    );
  }

  // ── Error state ──
  if (loadError && requests.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <CompactHeader title="Prontuário" subtitle={patientName} topInset={insets.top} onBack={() => router.back()} colors={colors} gradientColors={gradients.doctorHeader} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <AppEmptyState
            icon="alert-circle-outline"
            title="Erro ao carregar"
            subtitle="Verifique sua conexão e tente novamente."
            actionLabel="Tentar novamente"
            onAction={() => loadData()}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Fixed header */}
      <CompactHeader
        title="Prontuário"
        subtitle={patientName}
        topInset={insets.top}
        onBack={() => router.back()}
        colors={colors}
        gradientColors={gradients.doctorHeader}
        hasAlerts={allAllergies.length > 0 || (structured?.alerts?.length ?? 0) > 0}
      />

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <AppSegmentedControl
          items={TAB_ITEMS.map((t) => ({ key: t.key, label: t.label }))}
          value={activeTab}
          onValueChange={(v) => {
            haptics.selection();
            setActiveTab(v as TabKey);
          }}
          size="sm"
          scrollable
        />
      </View>

      {/* Scrollable content */}
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
        {/* Patient identity + alerts — shown on all tabs */}
        <PatientIdentityCard
          profile={profile}
          patientName={patientName}
          consultationCount={consultations.length}
          prescriptionCount={prescriptions.length}
          examCount={exams.length}
          allergies={allAllergies}
        />

        {/* Alerts banner (only if present) */}
        <AlertsBanner
          allergies={allAllergies}
          alerts={structured?.alerts ?? []}
          style={styles.sectionGap}
        />

        {/* Tab content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <ClinicalOverviewTab
              structured={structured}
              narrativeSummary={summary}
              summaryLoading={summaryLoading}
              consultationCount={consultations.length}
              allergies={allAllergies}
              lastConsultationDays={lastConsultationDays}
            />
          )}

          {activeTab === 'consultations' && (
            <ConsultationsTab consultations={consultations} />
          )}

          {activeTab === 'documents' && (
            <DocumentsTab prescriptions={prescriptions} exams={exams} />
          )}

          {activeTab === 'notes' && (
            <ClinicalNotesTab
              patientId={id}
              doctorNotes={doctorNotes}
              onNotesChanged={setDoctorNotes}
              requests={sortedRequests}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Compact Header ──

function CompactHeader({
  title,
  subtitle,
  topInset,
  onBack,
  colors,
  gradientColors,
  hasAlerts,
}: {
  title: string;
  subtitle?: string;
  topInset: number;
  onBack: () => void;
  colors: DesignColors;
  gradientColors: string[];
  hasAlerts?: boolean;
}) {
  return (
    <LinearGradient
      colors={gradientColors as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: 16,
        paddingTop: topInset + 10,
        gap: 8,
      }}>
        <TouchableOpacity
          onPress={onBack}
          style={{
            width: 44, height: 44, borderRadius: 14,
            borderWidth: 1, borderColor: colors.headerOverlayBorder,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.headerOverlaySurface,
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={22} color={colors.headerOverlayText} />
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{
              fontSize: 17, fontWeight: '700', color: colors.headerOverlayText,
              letterSpacing: 0.2, flexShrink: 1,
            }} numberOfLines={1}>
              {title}
            </Text>
            {hasAlerts && (
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: colors.error, flexShrink: 0,
              }} />
            )}
          </View>
          {!!subtitle && (
            <Text style={{
              fontSize: 12, color: colors.headerOverlayTextMuted,
              marginTop: 2, fontWeight: '600', letterSpacing: 0.3,
              textTransform: 'uppercase',
            }} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={{ width: 44 }} />
      </View>
    </LinearGradient>
  );
}

// ── Styles ──

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingWrap: { flex: 1, backgroundColor: colors.background },
    tabsWrap: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    scroll: { flex: 1 },
    scrollContent: {
      padding: spacing.md,
      gap: spacing.md,
    },
    sectionGap: {
      marginTop: 0,
    },
    tabContent: {
      gap: spacing.md,
    },
  });
}
