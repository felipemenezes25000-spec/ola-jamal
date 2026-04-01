import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors, DesignTokens } from '../../lib/designSystem';
import { uiTokens } from '../../lib/ui/tokens';
import { useListBottomPadding } from '../../lib/ui/responsive';
import {
  fetchMyPatientSummary,
  fetchMyEncounters,
  fetchMyDocuments,
} from '../../lib/api';
import type {
  PatientSummaryDto,
  EncounterSummaryDto,
  MedicalDocumentSummaryDto,
  DocumentTypeName,
} from '../../types/database';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useAuth } from '../../contexts/AuthContext';
import { useTriageEval } from '../../hooks/useTriageEval';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';
import { motionTokens } from '../../lib/ui/motion';

/* ─── Constants ─────────────────────────────────────────────────── */

type TabKey = 'resumo' | 'historico' | 'documentos';
type FilterChip = 'todos' | 'receitas' | 'exames' | 'consultas';

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'resumo', label: 'Resumo', icon: 'heart-outline' },
  { key: 'historico', label: 'Histórico', icon: 'time-outline' },
  { key: 'documentos', label: 'Documentos', icon: 'document-text-outline' },
];

const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'receitas', label: 'Receitas' },
  { key: 'exames', label: 'Exames' },
  { key: 'consultas', label: 'Consultas' },
];

const MONTHS_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

/* ─── Helpers ───────────────────────────────────────────────────── */

function formatDatePt(iso: string | Date | null | undefined): string {
  if (iso == null) return '—';
  const d = iso instanceof Date ? iso : new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS_PT[d.getMonth()] ?? '?';
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return '•••.•••.•••-••';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length < 11) return cpf;
  return `•••.${digits.slice(3, 6)}.•••-${digits.slice(9, 11)}`;
}

function computeAge(birthDate: string | null | undefined): number | undefined {
  if (!birthDate) return undefined;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : undefined;
}

function formatSex(sex: string | null | undefined): string {
  if (!sex) return '';
  const s = sex.toLowerCase();
  if (s === 'm' || s === 'male' || s === 'masculino') return 'Masculino';
  if (s === 'f' || s === 'female' || s === 'feminino') return 'Feminino';
  return sex;
}

function getEncounterMeta(colors: DesignColors): Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> {
  return {
    teleconsulta: { icon: 'videocam', color: colors.info, bg: colors.infoLight, label: 'Teleconsulta' },
    consultation: { icon: 'videocam', color: colors.info, bg: colors.infoLight, label: 'Consulta' },
    renovacao: { icon: 'refresh', color: colors.success, bg: colors.successLight, label: 'Renovação' },
    prescription: { icon: 'medical', color: colors.accent, bg: colors.accentSoft, label: 'Receita' },
    exame: { icon: 'flask', color: colors.accent, bg: colors.accentSoft, label: 'Exame' },
    exam: { icon: 'flask', color: colors.accent, bg: colors.accentSoft, label: 'Exame' },
    '1': { icon: 'videocam', color: colors.info, bg: colors.infoLight, label: 'Teleconsulta' },
    '2': { icon: 'refresh', color: colors.success, bg: colors.successLight, label: 'Renovação' },
    '3': { icon: 'flask', color: colors.accent, bg: colors.accentSoft, label: 'Exame' },
  };
}

function getDocTypeMeta(colors: DesignColors): Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> {
  return {
    prescription: { icon: 'medical', color: colors.accent, bg: colors.accentSoft, label: 'Receita' },
    exam: { icon: 'flask', color: colors.accent, bg: colors.accentSoft, label: 'Exame' },
    report: { icon: 'document-text', color: colors.info, bg: colors.infoLight, label: 'Laudo' },
    atestado: { icon: 'ribbon', color: colors.warning, bg: colors.warningLight, label: 'Atestado' },
    exam_order: { icon: 'flask', color: colors.accent, bg: colors.accentSoft, label: 'Exame' },
    examorder: { icon: 'flask', color: colors.accent, bg: colors.accentSoft, label: 'Exame' },
    medicalreport: { icon: 'document-text', color: colors.info, bg: colors.infoLight, label: 'Laudo' },
    medicalcertificate: { icon: 'ribbon', color: colors.warning, bg: colors.warningLight, label: 'Atestado' },
    '1': { icon: 'medical', color: colors.accent, bg: colors.accentSoft, label: 'Receita' },
    '2': { icon: 'flask', color: colors.accent, bg: colors.accentSoft, label: 'Exame' },
    '3': { icon: 'document-text', color: colors.info, bg: colors.infoLight, label: 'Laudo' },
  };
}

function getDocStatusMeta(colors: DesignColors): Record<string, { color: string; bg: string; label: string }> {
  return {
    signed: { color: colors.success, bg: colors.successLight, label: 'Assinado' },
    draft: { color: colors.warning, bg: colors.warningLight, label: 'Rascunho' },
    cancelled: { color: colors.textMuted, bg: colors.surfaceSecondary, label: 'Cancelado' },
  };
}

function normalizeDocumentType(value: unknown): DocumentTypeName {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'prescription' || normalized === '1') return 'prescription';
  if (normalized === 'examorder' || normalized === 'exam_order' || normalized === 'exam' || normalized === '2') return 'examOrder';
  return 'medicalReport';
}

type RecordListItem =
  | { kind: 'resumo'; id: 'resumo' }
  | { kind: 'encounter'; data: EncounterSummaryDto }
  | { kind: 'document'; data: MedicalDocumentSummaryDto };

/* ─── Main Screen ───────────────────────────────────────────────── */

export default function PatientRecordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listPadding = useListBottomPadding();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<TabKey>('resumo');
  const [activeFilter, setActiveFilter] = useState<FilterChip>('todos');
  const [avatarError, setAvatarError] = useState(false);

  const [summary, setSummary] = useState<PatientSummaryDto | null>(null);
  const [encounters, setEncounters] = useState<EncounterSummaryDto[]>([]);
  const [documents, setDocuments] = useState<MedicalDocumentSummaryDto[]>([]);
  const lastLoadedAt = useRef<number>(0);
  const RECORD_STALE_MS = 60_000;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const { colors, gradients, shadows } = useAppTheme();
  const s = useMemo(() => makeStyles(colors, shadows, screenWidth), [colors, shadows, screenWidth]);

  const cancelledRef = useRef(false);

  // Dados para sugestoes proativas da Dra. Renoveja
  const lastPrescriptionDaysAgo = useMemo(() => {
    try {
      const rxDocs = (documents ?? []).filter((d) => String(d?.documentType ?? '').toLowerCase() === 'prescription' && d?.signedAt);
      if (rxDocs.length === 0) return undefined;
      const last = rxDocs.sort((a, b) => (new Date(b.signedAt ?? 0).getTime()) - (new Date(a.signedAt ?? 0).getTime()))[0];
      const ts = new Date(last?.signedAt ?? 0).getTime();
      if (Number.isNaN(ts)) return undefined;
      return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
    } catch {
      return undefined;
    }
  }, [documents]);

  const lastExamDaysAgo = useMemo(() => {
    try {
      const docType = (t: string | number | null | undefined) => String(t ?? '').toLowerCase();
      const examDocs = (documents ?? []).filter((d) => {
        const t = docType(d?.documentType);
        return (t === 'exam' || t === 'exam_order' || t === '2') && d?.signedAt;
      });
      if (examDocs.length === 0) return undefined;
      const last = examDocs.sort((a, b) => (new Date(b.signedAt ?? 0).getTime()) - (new Date(a.signedAt ?? 0).getTime()))[0];
      const ts = new Date(last?.signedAt ?? 0).getTime();
      if (Number.isNaN(ts)) return undefined;
      return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
    } catch {
      return undefined;
    }
  }, [documents]);

  const patientAge = useMemo(() => {
    return computeAge(summary?.birthDate ?? user?.birthDate);
  }, [summary?.birthDate, user?.birthDate]);

  const recentPrescriptionCount = summary?.stats?.totalPrescriptions ?? 0;

  useTriageEval({
    context: 'record',
    step: 'entry',
    role: 'patient',
    lastPrescriptionDaysAgo,
    lastExamDaysAgo,
    patientAge,
    recentPrescriptionCount,
  });

  const load = useCallback(async (withFeedback = false) => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    cancelledRef.current = false;
    setError(false);
    try {
      const [summaryData, encountersData, documentsData] = await Promise.all([
        fetchMyPatientSummary(),
        fetchMyEncounters().catch(() => [] as EncounterSummaryDto[]),
        fetchMyDocuments().catch(() => [] as MedicalDocumentSummaryDto[]),
      ]);
      if (cancelledRef.current) return;
      let safeSummary: PatientSummaryDto | null = null;
      try {
        safeSummary = summaryData && typeof summaryData === 'object'
          ? {
              ...summaryData,
              id: String(summaryData.id ?? ''),
              name: summaryData.name && typeof summaryData.name === 'object'
                ? { ...summaryData.name, full: String(summaryData.name?.full ?? '') }
                : { full: '' },
              identifier: summaryData.identifier && typeof summaryData.identifier === 'object'
                ? { ...summaryData.identifier, cpf: String(summaryData.identifier?.cpf ?? '') }
                : { cpf: '' },
              stats: summaryData.stats && typeof summaryData.stats === 'object'
                ? {
                    totalRequests: Number(summaryData.stats.totalRequests) || 0,
                    totalPrescriptions: Number(summaryData.stats.totalPrescriptions) || 0,
                    totalExams: Number(summaryData.stats.totalExams) || 0,
                    totalConsultations: Number(summaryData.stats.totalConsultations) || 0,
                    lastConsultationDate: summaryData.stats.lastConsultationDate ?? null,
                    lastConsultationDaysAgo: summaryData.stats.lastConsultationDaysAgo ?? null,
                  }
                : { totalRequests: 0, totalPrescriptions: 0, totalExams: 0, totalConsultations: 0, lastConsultationDate: null, lastConsultationDaysAgo: null },
              medications: Array.isArray(summaryData.medications)
                ? summaryData.medications.map((m) => String(m ?? '').trim()).filter(Boolean)
                : [],
              exams: Array.isArray(summaryData.exams)
                ? summaryData.exams.map((e) => String(e ?? '').trim()).filter(Boolean)
                : [],
            }
          : null;
      } catch {
        safeSummary = null;
      }
      if (cancelledRef.current) return;
      lastLoadedAt.current = Date.now();
      setSummary(safeSummary);
      const safeEncounters = Array.isArray(encountersData)
        ? encountersData
            .filter((e): e is EncounterSummaryDto => e != null && typeof e === 'object')
            .map((e) => ({
              id: String(e?.id ?? ''),
              type: e?.type ?? '',
              startedAt: e?.startedAt != null ? (typeof e.startedAt === 'string' ? e.startedAt : new Date(e.startedAt).toISOString()) : '',
              finishedAt: e?.finishedAt ?? null,
              mainIcd10Code: e?.mainIcd10Code ?? null,
            }))
        : [];
      setEncounters(safeEncounters);
      const safeDocuments = Array.isArray(documentsData)
        ? documentsData
            .filter((d): d is MedicalDocumentSummaryDto => d != null && typeof d === 'object')
            .map((d) => ({
              id: String(d?.id ?? ''),
              documentType: normalizeDocumentType(d?.documentType),
              status: String(d?.status ?? 'draft'),
              createdAt: d?.createdAt != null ? (typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt).toISOString()) : '',
              signedAt: d?.signedAt != null ? (typeof d.signedAt === 'string' ? d.signedAt : new Date(d.signedAt).toISOString()) : null,
              encounterId: d?.encounterId != null ? String(d.encounterId) : null,
            }))
        : [];
      setDocuments(safeDocuments);
      if (withFeedback) {
        showToast({ message: 'Prontuario atualizado', type: 'success' });
      }
    } catch {
      if (cancelledRef.current) return;
      setError(true);
      setSummary(null);
      setEncounters([]);
      setDocuments([]);
      if (withFeedback) {
        showToast({ message: 'Nao foi possivel atualizar o prontuario', type: 'error' });
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        if (Date.now() - lastLoadedAt.current > RECORD_STALE_MS) load();
      } else {
        setLoading(false);
      }
      return () => {
        cancelledRef.current = true;
      };
    }, [load, user?.id])
  );

  const onRefresh = () => {
    haptics.light();
    setRefreshing(true);
    load(true);
  };

  const fullName = summary?.name?.full || user?.name || 'Paciente';
  const initials = fullName
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase())
    .join('');

  const filteredEncounters = useMemo(() => {
    const valid = (encounters ?? []).filter((e): e is EncounterSummaryDto => e != null && typeof e === 'object');
    if (activeFilter === 'todos') return valid;
    const mapping: Record<FilterChip, string[]> = {
      todos: [],
      receitas: ['prescription', 'renovacao', '2'],
      exames: ['exam', 'exame', '3'],
      consultas: ['teleconsulta', 'consultation', '1'],
    };
    const allowed = mapping[activeFilter];
    return valid.filter((e) => allowed.includes(String(e?.type ?? '').toLowerCase()));
  }, [encounters, activeFilter]);

  const filteredDocuments = useMemo(() => {
    const valid = (documents ?? []).filter((d): d is MedicalDocumentSummaryDto => d != null && typeof d === 'object');
    if (activeFilter === 'todos') return valid;
    const mapping: Record<FilterChip, string[]> = {
      todos: [],
      receitas: ['prescription', '1'],
      exames: ['exam', 'exam_order', 'examorder', '2'],
      consultas: ['report', 'medicalreport', '3'],
    };
    const allowed = mapping[activeFilter];
    return valid.filter((d) => allowed.includes(String(d?.documentType ?? '').toLowerCase()));
  }, [documents, activeFilter]);

  const listData = useMemo<RecordListItem[]>(() => {
    if (activeTab === 'resumo') return [{ kind: 'resumo', id: 'resumo' }];
    if (activeTab === 'historico') return filteredEncounters.map((data) => ({ kind: 'encounter', data }));
    return filteredDocuments.map((data) => ({ kind: 'document', data }));
  }, [activeTab, filteredEncounters, filteredDocuments]);

  return (
    <ErrorBoundary>
      <View style={s.container}>
        {loading ? (
          <View style={s.loadingWrap}>
            <View style={[s.skeletonHeader, { paddingTop: insets.top + 12 }]}>
              <View style={s.skeletonHeaderRow}>
                <View style={s.skeletonHeaderText}>
                  <View style={[s.skeletonBar, { width: 120, height: 14 }]} />
                  <View style={[s.skeletonBar, { width: 180, height: 22, marginTop: 8 }]} />
                  <View style={[s.skeletonBar, { width: 100, height: 12, marginTop: 6 }]} />
                </View>
                <View style={s.skeletonAvatar} />
              </View>
            </View>
            <View style={{ paddingHorizontal: uiTokens.screenPaddingHorizontal, paddingTop: 16 }}>
              <SkeletonList count={4} />
            </View>
          </View>
        ) : error ? (
          <View style={s.errorWrap}>
            <View style={s.errorIconCircle}>
              <Ionicons name="cloud-offline-outline" size={40} color={colors.error} />
            </View>
            <Text style={s.errorTitle}>Erro ao carregar</Text>
            <Text style={s.errorSubtitle}>Verifique sua conexao e tente novamente</Text>
            <Pressable
              style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              onPress={() => load()}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : (
          <FadeIn visible={!loading} {...motionTokens.fade.patientRecord}>
            <FlatList
              style={s.container}
              contentContainerStyle={{ paddingBottom: listPadding }}
              showsVerticalScrollIndicator={false}
              data={listData}
              keyExtractor={(item, idx) => {
                if (item.kind === 'resumo') return item.id;
                if (item.kind === 'encounter') return item.data.id ?? `enc-${idx}`;
                return item.data.id ?? `doc-${idx}`;
              }}
              getItemLayout={(_: unknown, i: number) => ({ length: 88, offset: 88 * i, index: i })}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              ListHeaderComponent={
                <>
                  {/* ─── Header with Gradient ─── */}
                  <LinearGradient
                    colors={gradients.patientHeader as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.header, { paddingTop: insets.top + 16 }]}
                  >
                    <Text style={s.headerLabel}>Meu Prontuario</Text>

                    {/* Patient Identity Card */}
                    <View style={s.identityCard}>
                      <View style={s.identityLeft}>
                        <View style={s.avatarCircle}>
                          {user?.avatarUrl && !avatarError ? (
                            <Image
                              source={{ uri: user.avatarUrl }}
                              style={s.avatarImage}
                              resizeMode="cover"
                              onError={() => setAvatarError(true)}
                            />
                          ) : (
                            <Text style={s.avatarText}>{initials}</Text>
                          )}
                        </View>
                      </View>
                      <View style={s.identityRight}>
                        <Text style={s.identityName} numberOfLines={1}>{fullName}</Text>
                        <View style={s.identityDetailsRow}>
                          {patientAge != null && (
                            <View style={s.identityChip}>
                              <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.8)" />
                              <Text style={s.identityChipText}>{patientAge} anos</Text>
                            </View>
                          )}
                          {summary?.sex && (
                            <View style={s.identityChip}>
                              <Ionicons name="person-outline" size={11} color="rgba(255,255,255,0.8)" />
                              <Text style={s.identityChipText}>{formatSex(summary.sex)}</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.identityCpfRow}>
                          <Ionicons name="shield-checkmark-outline" size={12} color="rgba(255,255,255,0.6)" />
                          <Text style={s.identityCpfText}>
                            CPF {maskCpf(summary?.identifier?.cpf)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>

                  {/* ─── Tab Bar ─── */}
                  <View style={s.tabBar}>
                    {TABS.map((tab) => {
                      const isActive = activeTab === tab.key;
                      return (
                        <Pressable
                          key={tab.key}
                          style={[s.tabItem, isActive && s.tabItemActive]}
                          onPress={() => {
                            haptics.selection();
                            setActiveTab(tab.key);
                            if (tab.key !== 'resumo') setActiveFilter('todos');
                          }}
                        >
                          <Ionicons
                            name={tab.icon}
                            size={18}
                            color={isActive ? colors.primary : colors.textMuted}
                          />
                          <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>
                            {tab.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* ─── Filter Chips (Historico + Documentos) ─── */}
                  {(activeTab === 'historico' || activeTab === 'documentos') && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.filterRow}
                    >
                      {FILTER_CHIPS.map((chip) => {
                        const isActive = activeFilter === chip.key;
                        return (
                          <Pressable
                            key={chip.key}
                            style={[s.filterChip, isActive && s.filterChipActive]}
                            onPress={() => {
                              haptics.selection();
                              setActiveFilter(chip.key);
                            }}
                          >
                            <Text style={[s.filterChipText, isActive && s.filterChipTextActive]}>
                              {chip.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}

                  {/* ─── Summary Tab Content ─── */}
                  {activeTab === 'resumo' && (
                    <SummaryTab summary={summary} router={router} />
                  )}
                </>
              }
              renderItem={({ item, index }) => {
                if (item.kind === 'resumo') return null;
                if (item.kind === 'encounter') {
                  return <TimelineItem encounter={item.data} index={index} total={filteredEncounters.length} />;
                }
                return <DocumentItem document={item.data} index={index} router={router} />;
              }}
              ListEmptyComponent={
                activeTab !== 'resumo' ? (
                  <View style={s.tabEmptyWrap}>
                    <View style={s.emptyIllustration}>
                      <Ionicons
                        name={activeTab === 'historico' ? 'time-outline' : 'document-text-outline'}
                        size={48}
                        color={colors.border}
                      />
                    </View>
                    <Text style={s.emptyTitle}>
                      {activeTab === 'historico' ? 'Nenhum atendimento' : 'Nenhum documento'}
                    </Text>
                    <Text style={s.emptySubtitle}>
                      {activeTab === 'historico'
                        ? 'Seus atendimentos aparecerao aqui apos sua primeira consulta'
                        : 'Seus documentos medicos aparecerao aqui'}
                    </Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                <View style={s.legalNote}>
                  <View style={s.legalIconWrap}>
                    <Ionicons name="shield-checkmark" size={14} color={colors.textMuted} />
                  </View>
                  <Text style={s.legalText}>
                    Este resumo e gerado a partir das consultas, receitas e exames feitos pelo
                    RenoveJa+. Para fins oficiais, use sempre os PDFs assinados digitalmente.
                  </Text>
                </View>
              }
            />
          </FadeIn>
        )}
      </View>
    </ErrorBoundary>
  );
}

/* ─── Summary Tab ───────────────────────────────────────────────── */

function SummaryTab({
  summary,
  router,
}: {
  summary: PatientSummaryDto | null;
  router: ReturnType<typeof useRouter>;
}) {
  const { colors, shadows } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const s = useMemo(() => makeStyles(colors, shadows, screenWidth), [colors, shadows, screenWidth]);

  return (
    <>
      {/* ─── Stats Grid (2x2) ─── */}
      <View style={s.statsGrid}>
        <View style={s.statsRow}>
          <StatCard
            icon="pulse-outline"
            label="Pedidos"
            value={summary?.stats?.totalRequests ?? 0}
            color={colors.primary}
            bgColor={colors.primarySoft}
          />
          <StatCard
            icon="document-text-outline"
            label="Receitas"
            value={summary?.stats?.totalPrescriptions ?? 0}
            color="#22C55E"
            bgColor={colors.successLight}
          />
        </View>
        <View style={s.statsRow}>
          <StatCard
            icon="flask-outline"
            label="Exames"
            value={summary?.stats?.totalExams ?? 0}
            color={colors.info}
            bgColor={colors.infoLight}
          />
          <StatCard
            icon="videocam-outline"
            label="Consultas"
            value={summary?.stats?.totalConsultations ?? 0}
            color="#8B5CF6"
            bgColor={colors.accentSoft}
          />
        </View>
      </View>

      {/* ─── Last Consultation Banner ─── */}
      {summary?.stats?.lastConsultationDate && (() => {
        try {
          const d = new Date(summary!.stats!.lastConsultationDate!);
          if (Number.isNaN(d.getTime())) return null;
          return (
            <View style={s.lastConsultBanner}>
              <View style={s.lastConsultIcon}>
                <Ionicons name="calendar" size={16} color={colors.primary} />
              </View>
              <View style={s.lastConsultTextWrap}>
                <Text style={s.lastConsultLabel}>Ultima consulta</Text>
                <Text style={s.lastConsultDate}>
                  {d.toLocaleDateString('pt-BR')}
                  {summary!.stats!.lastConsultationDaysAgo != null &&
                    ` — ha ${summary!.stats!.lastConsultationDaysAgo} dia(s)`}
                </Text>
              </View>
            </View>
          );
        } catch {
          return null;
        }
      })()}

      {/* ─── Medications Section ─── */}
      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <View style={[s.sectionIconCircle, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="medical" size={18} color="#8B5CF6" />
          </View>
          <View style={s.sectionHeaderText}>
            <Text style={s.sectionTitle}>Medicamentos em uso</Text>
            <Text style={s.sectionHint}>Extraidos das suas receitas</Text>
          </View>
          {(summary?.medications?.length ?? 0) > 0 && (
            <View style={s.sectionCountBadge}>
              <Text style={s.sectionCountText}>{summary?.medications?.length}</Text>
            </View>
          )}
        </View>
        {(summary?.medications?.length ?? 0) > 0 ? (
          <View style={s.chipWrap}>
            {(summary?.medications ?? []).map((m, idx) => (
              <View key={`med-${idx}`} style={s.medChip}>
                <View style={[s.medChipDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={s.medChipText} numberOfLines={1}>{String(m ?? '')}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.emptySection}>
            <Ionicons name="leaf-outline" size={24} color={colors.border} />
            <Text style={s.emptySectionText}>
              Nenhum medicamento registrado ainda
            </Text>
          </View>
        )}
      </View>

      {/* ─── Exams Section ─── */}
      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <View style={[s.sectionIconCircle, { backgroundColor: colors.infoLight }]}>
            <Ionicons name="flask" size={18} color={colors.info} />
          </View>
          <View style={s.sectionHeaderText}>
            <Text style={s.sectionTitle}>Exames recentes</Text>
            <Text style={s.sectionHint}>Solicitados pelo app</Text>
          </View>
          {(summary?.exams?.length ?? 0) > 0 && (
            <View style={[s.sectionCountBadge, { backgroundColor: colors.infoLight }]}>
              <Text style={[s.sectionCountText, { color: colors.info }]}>{summary?.exams?.length}</Text>
            </View>
          )}
        </View>
        {(summary?.exams?.length ?? 0) > 0 ? (
          <View style={s.listWrap}>
            {(summary?.exams ?? []).map((e, idx) => (
              <View key={`exam-${idx}`} style={s.listItem}>
                <View style={[s.listDot, { backgroundColor: colors.info }]} />
                <Text style={s.listItemText}>{String(e ?? '')}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.emptySection}>
            <Ionicons name="flask-outline" size={24} color={colors.border} />
            <Text style={s.emptySectionText}>Nenhum exame registrado ainda</Text>
          </View>
        )}
      </View>

      {/* ─── Quick Action ─── */}
      <Pressable
        style={({ pressed }) => [
          s.actionCard,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
        onPress={() => router.push('/(patient)/requests')}
      >
        <View style={s.actionIconWrap}>
          <Ionicons name="time-outline" size={22} color={colors.primary} />
        </View>
        <View style={s.actionTextWrap}>
          <Text style={s.actionTitle}>Ver historico completo</Text>
          <Text style={s.actionSubtitle}>Todos os seus pedidos e documentos</Text>
        </View>
        <View style={s.actionArrow}>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </Pressable>
    </>
  );
}

/* ─── Timeline Item ─────────────────────────────────────────────── */

const TimelineItem = React.memo(function TimelineItem({
  encounter: enc,
  index: idx,
  total,
}: {
  encounter: EncounterSummaryDto;
  index: number;
  total: number;
}) {
  const { colors, shadows } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const s = useMemo(() => makeStyles(colors, shadows, screenWidth), [colors, shadows, screenWidth]);
  const ENCOUNTER_META = useMemo(() => getEncounterMeta(colors), [colors]);

  const typeKey = String(enc?.type ?? '').toLowerCase();
  const meta = ENCOUNTER_META[typeKey] ?? {
    icon: 'ellipse' as const,
    color: colors.textMuted,
    bg: colors.surfaceSecondary,
    label: String(enc?.type ?? ''),
  };
  const isLast = idx === total - 1;
  const isFinished = !!enc?.finishedAt;

  return (
    <View style={[s.timelineRow, { paddingHorizontal: uiTokens.screenPaddingHorizontal }]}>
      {/* Timeline spine */}
      <View style={s.timelineLineCol}>
        <View style={[s.timelineDot, { backgroundColor: meta.color }]}>
          <Ionicons name={meta.icon} size={13} color="#FFFFFF" />
        </View>
        {!isLast && <View style={[s.timelineLine, { backgroundColor: colors.border }]} />}
      </View>

      {/* Card */}
      <View style={[s.timelineCard, isLast && { marginBottom: 4 }]}>
        <View style={s.timelineCardHeader}>
          <View style={[s.timelineTypeBadge, { backgroundColor: meta.bg }]}>
            <Text style={[s.timelineTypeText, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
          <Text style={s.timelineDate}>{formatDatePt(enc?.startedAt)}</Text>
        </View>

        {enc?.mainIcd10Code && (
          <Text style={s.timelineDescription} numberOfLines={2}>
            {enc.mainIcd10Code}
          </Text>
        )}

        <View style={s.timelineFooter}>
          <View style={s.timelineStatusRow}>
            <View
              style={[
                s.timelineStatusDot,
                { backgroundColor: isFinished ? '#22C55E' : '#F59E0B' },
              ]}
            />
            <Text style={s.timelineStatusText}>
              {isFinished ? 'Concluido' : 'Em andamento'}
            </Text>
          </View>
          {isFinished && enc.finishedAt && (
            <Text style={s.timelineFinishedDate}>
              {formatDatePt(enc.finishedAt)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
});

/* ─── Document Item ─────────────────────────────────────────────── */

const DocumentItem = React.memo(function DocumentItem({
  document: doc,
  index: _idx,
  router,
}: {
  document: MedicalDocumentSummaryDto;
  index: number;
  router: ReturnType<typeof useRouter>;
}) {
  const { colors, shadows } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const s = useMemo(() => makeStyles(colors, shadows, screenWidth), [colors, shadows, screenWidth]);
  const DOC_TYPE_META = useMemo(() => getDocTypeMeta(colors), [colors]);
  const DOC_STATUS_META = useMemo(() => getDocStatusMeta(colors), [colors]);

  const typeKey = String(doc.documentType ?? '').toLowerCase();
  const typeMeta = DOC_TYPE_META[typeKey] ?? {
    icon: 'document-outline' as const,
    color: colors.textMuted,
    bg: colors.surfaceSecondary,
    label: String(doc.documentType ?? 'Documento'),
  };
  const statusKey = String(doc.status ?? '').toLowerCase();
  const statusMeta = DOC_STATUS_META[statusKey] ?? {
    color: colors.textMuted,
    bg: colors.surfaceSecondary,
    label: String(doc.status ?? 'Documento'),
  };
  const isSigned = statusKey === 'signed';

  return (
    <View style={[s.docCard, { marginHorizontal: uiTokens.screenPaddingHorizontal, marginBottom: 10 }]}>
      {/* Type icon */}
      <View style={[s.docIconWrap, { backgroundColor: typeMeta.bg }]}>
        <Ionicons name={typeMeta.icon} size={22} color={typeMeta.color} />
      </View>

      {/* Content */}
      <View style={s.docContent}>
        <Text style={s.docTitle}>{typeMeta.label}</Text>
        <Text style={s.docDate}>
          {isSigned ? `Assinado em ${formatDatePt(doc.signedAt)}` : formatDatePt(doc.createdAt)}
        </Text>
        <View style={[s.docStatusBadge, { backgroundColor: statusMeta.bg }]}>
          <View style={[s.docStatusDot, { backgroundColor: statusMeta.color }]} />
          <Text style={[s.docStatusText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={s.docActions}>
        <Pressable
          style={({ pressed }) => [s.docActionBtn, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Alert.alert(
              typeMeta.label,
              `Documento ${statusMeta.label.toLowerCase()} em ${formatDatePt(doc.createdAt)}.\n\nPara baixar o PDF assinado, acesse a tela de Pedidos e localize o pedido correspondente.`,
              [
                { text: 'OK' },
                { text: 'Ir para Pedidos', onPress: () => router.push('/(patient)/requests') },
              ]
            );
          }}
        >
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
        </Pressable>
        {isSigned && (
          <Pressable
            style={({ pressed }) => [s.docActionBtnDownload, pressed && { opacity: 0.7 }]}
            onPress={() => {
              router.push('/(patient)/requests');
            }}
          >
            <Ionicons name="download-outline" size={18} color="#22C55E" />
          </Pressable>
        )}
      </View>
    </View>
  );
});

/* ─── Stat Card ─────────────────────────────────────────────────── */

function StatCard(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  const { colors, shadows } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const s = useMemo(() => makeStyles(colors, shadows, screenWidth), [colors, shadows, screenWidth]);

  return (
    <View style={s.statCard}>
      <View style={[s.statIconWrap, { backgroundColor: props.bgColor }]}>
        <Ionicons name={props.icon} size={18} color={props.color} />
      </View>
      <Text style={[s.statValue, { color: props.color }]}>{props.value}</Text>
      <Text style={s.statLabel}>{props.label}</Text>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────────── */

function makeStyles(colors: DesignColors, shadows: DesignTokens['shadows'], screenWidth: number) {
  const isSmall = screenWidth < 360;
  const px = isSmall ? 14 : uiTokens.screenPaddingHorizontal;

  return StyleSheet.create({
    /* ── Root ── */
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    /* ── Loading ── */
    loadingWrap: { flex: 1, backgroundColor: '#F8FAFC' },
    skeletonHeader: {
      backgroundColor: colors.primary,
      paddingHorizontal: px,
      paddingBottom: 28,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    skeletonHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    skeletonHeaderText: { flex: 1 },
    skeletonBar: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 6,
    },
    skeletonAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },

    /* ── Error ── */
    errorWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: px,
      backgroundColor: '#F8FAFC',
    },
    errorIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.errorLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    errorSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 28,
      backgroundColor: colors.primary,
      borderRadius: 16,
    },
    retryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

    /* ── Header ── */
    header: {
      paddingHorizontal: px,
      paddingBottom: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.8)',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 16,
    },

    /* ── Identity Card ── */
    identityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    identityLeft: {
      marginRight: 14,
    },
    avatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 28,
    },
    avatarText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    identityRight: {
      flex: 1,
    },
    identityName: {
      fontSize: isSmall ? 17 : 19,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 6,
    },
    identityDetailsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 6,
    },
    identityChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    identityChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.9)',
    },
    identityCpfRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    identityCpfText: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.6)',
      fontWeight: '500',
    },

    /* ── Tab Bar ── */
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: px,
      marginTop: 16,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 4,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      ...shadows.card,
    },
    tabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      gap: 6,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabItemActive: {
      backgroundColor: colors.primarySoft,
      borderBottomColor: '#0EA5E9',
    },
    tabLabel: {
      fontSize: isSmall ? 12 : 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabLabelActive: {
      color: '#0EA5E9',
      fontWeight: '700',
    },

    /* ── Filter Chips ── */
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: px,
      paddingVertical: 12,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#F1F5F9',
    },
    filterChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: '#0EA5E9',
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterChipTextActive: {
      color: '#0EA5E9',
    },

    /* ── Stats Grid ── */
    statsGrid: {
      paddingHorizontal: px,
      paddingTop: 16,
      gap: 10,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: isSmall ? 12 : 14,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      ...shadows.card,
    },
    statIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    statValue: {
      fontSize: isSmall ? 22 : 26,
      fontWeight: '700',
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 2,
    },

    /* ── Last Consultation Banner ── */
    lastConsultBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 12,
      marginHorizontal: px,
      marginTop: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: `${colors.primary}20`,
    },
    lastConsultIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    lastConsultTextWrap: { flex: 1 },
    lastConsultLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    lastConsultDate: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginTop: 2,
    },

    /* ── Section Cards ── */
    sectionCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginHorizontal: px,
      marginTop: 16,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      ...shadows.card,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 10,
    },
    sectionIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionHeaderText: { flex: 1 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    sectionHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    sectionCountBadge: {
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    sectionCountText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#8B5CF6',
    },

    /* ── Medication Chips ── */
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    medChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#F8FAFC',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#F1F5F9',
    },
    medChipDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    medChipText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      maxWidth: screenWidth * 0.55,
    },

    /* ── List Items ── */
    listWrap: { gap: 8 },
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 6,
      paddingHorizontal: 4,
      backgroundColor: '#F8FAFC',
      borderRadius: 8,
    },
    listDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginTop: 7,
    },
    listItemText: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    emptySection: {
      alignItems: 'center',
      paddingVertical: 20,
      gap: 8,
    },
    emptySectionText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },

    /* ── Action Card ── */
    actionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginHorizontal: px,
      marginTop: 16,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      ...shadows.card,
    },
    actionIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    actionTextWrap: { flex: 1 },
    actionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    actionSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
    actionArrow: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: '#F8FAFC',
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ── Legal Note ── */
    legalNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: px + 4,
      paddingVertical: 24,
    },
    legalIconWrap: {
      width: 24,
      height: 24,
      borderRadius: 8,
      backgroundColor: '#F8FAFC',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    legalText: {
      flex: 1,
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18,
    },

    /* ── Empty State ── */
    tabEmptyWrap: {
      paddingTop: 48,
      paddingHorizontal: px,
      alignItems: 'center',
    },
    emptyIllustration: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
      borderColor: '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 280,
    },

    /* ── Timeline ── */
    timelineRow: {
      flexDirection: 'row',
    },
    timelineLineCol: {
      width: 40,
      alignItems: 'center',
    },
    timelineDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      marginTop: -2,
      borderRadius: 1,
    },
    timelineCard: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 14,
      marginLeft: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      ...shadows.card,
    },
    timelineCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    timelineTypeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    timelineTypeText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    timelineDate: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    timelineDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 8,
    },
    timelineFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    timelineStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    timelineStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    timelineStatusText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    timelineFinishedDate: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },

    /* ── Documents ── */
    docCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      ...shadows.card,
    },
    docIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    docContent: {
      flex: 1,
      marginLeft: 12,
    },
    docTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    docDate: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 3,
    },
    docStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      marginTop: 6,
      gap: 5,
    },
    docStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    docStatusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    docActions: {
      flexDirection: 'column',
      gap: 6,
      marginLeft: 8,
    },
    docActionBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    docActionBtnDownload: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.successLight,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ── Unused but kept for compat ── */
    segmentBar: {
      flexDirection: 'row',
      marginHorizontal: px,
      marginTop: 16,
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      padding: 4,
      ...shadows.card,
    },
    segmentItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      gap: 5,
    },
    segmentItemActive: {
      backgroundColor: colors.primarySoft,
    },
    segmentLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    segmentLabelActive: {
      color: colors.primary,
    },
    docsContainer: {
      paddingHorizontal: px,
      gap: 10,
      paddingTop: 4,
    },
    timelineContainer: {
      paddingHorizontal: px,
      paddingTop: 4,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    headerTextCol: { flex: 1, paddingRight: 12 },
    headerName: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.headerOverlayText,
      marginTop: 2,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.headerOverlayTextMuted,
      marginTop: 6,
      lineHeight: 18,
    },
  });
}
