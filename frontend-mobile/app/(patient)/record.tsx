import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { shadows } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
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
} from '../../types/database';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { AppSegmentedControl, AppEmptyState } from '../../components/ui';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useAuth } from '../../contexts/AuthContext';
import { useTriageEval } from '../../hooks/useTriageEval';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';
import { motionTokens } from '../../lib/ui/motion';

type TabKey = 'resumo' | 'timeline' | 'documentos';
type FilterChip = 'todos' | 'receitas' | 'exames' | 'consultas';

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'resumo', label: 'Resumo', icon: 'heart-outline' },
  { key: 'timeline', label: 'Timeline', icon: 'time-outline' },
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

function formatDatePt(iso: string | Date | null | undefined): string {
  if (iso == null) return '—';
  const d = iso instanceof Date ? iso : new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS_PT[d.getMonth()] ?? '?';
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function getEncounterMeta(colors: DesignColors): Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> {
  return {
    teleconsulta: { icon: 'videocam', color: colors.info, bg: colors.infoLight, label: 'Teleconsulta' },
    consultation: { icon: 'videocam', color: colors.info, bg: colors.infoLight, label: 'Consulta' },
    renovacao: { icon: 'refresh', color: colors.success, bg: colors.successLight, label: 'Renovação' },
    prescription: { icon: 'medical', color: colors.accent, bg: colors.accentSoft, label: 'Receita' },
    exame: { icon: 'flask', color: colors.accent, bg: colors.accentSoft, label: 'Exame' },
    exam: { icon: 'flask', color: colors.accent, bg: colors.accentSoft, label: 'Exame' },
    // EncounterType enum (backend): 1=Teleconsultation, 2=PrescriptionRenewal, 3=ExamOrder
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
    // DocumentType enum (backend): 1=Prescription, 2=ExamOrder, 3=MedicalReport
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

export default function PatientRecordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listPadding = useListBottomPadding();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('resumo');
  const [activeFilter, setActiveFilter] = useState<FilterChip>('todos');

  const [summary, setSummary] = useState<PatientSummaryDto | null>(null);
  const [encounters, setEncounters] = useState<EncounterSummaryDto[]>([]);
  const [documents, setDocuments] = useState<MedicalDocumentSummaryDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const { colors, gradients } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const cancelledRef = useRef(false);

  // Dados para sugestões proativas da Dra. Renoveja
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
    const bd = summary?.birthDate ?? user?.birthDate;
    if (!bd) return undefined;
    const birth = new Date(bd);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : undefined;
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
    cancelledRef.current = false;
    setError(false);
    try {
      const [summaryData, encountersData, documentsData] = await Promise.all([
        fetchMyPatientSummary(),
        fetchMyEncounters().catch(() => [] as EncounterSummaryDto[]),
        fetchMyDocuments().catch(() => [] as MedicalDocumentSummaryDto[]),
      ]);
      if (cancelledRef.current) return;
      // Normalização defensiva: garante estrutura válida para evitar crashes
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
              documentType: String(d?.documentType ?? ''),
              status: String(d?.status ?? 'draft'),
              createdAt: d?.createdAt != null ? (typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt).toISOString()) : '',
              signedAt: d?.signedAt != null ? (typeof d.signedAt === 'string' ? d.signedAt : new Date(d.signedAt).toISOString()) : null,
              encounterId: d?.encounterId != null ? String(d.encounterId) : null,
            }))
        : [];
      setDocuments(safeDocuments);
      if (withFeedback) {
        showToast({ message: 'Prontuário atualizado', type: 'success' });
      }
    } catch {
      if (cancelledRef.current) return;
      setError(true);
      setSummary(null);
      setEncounters([]);
      setDocuments([]);
      if (withFeedback) {
        showToast({ message: 'Não foi possível atualizar o prontuário', type: 'error' });
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        cancelledRef.current = true;
      };
    }, [load])
  );

  const onRefresh = () => {
    haptics.light();
    setRefreshing(true);
    load(true);
  };

  const firstName =
    summary?.name?.full?.split(' ')[0] ?? user?.name?.split(' ')[0] ?? 'Paciente';
  const initials = (summary?.name?.full ?? user?.name ?? 'P')
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
      exames: ['exam', 'exam_order', '2'],
      consultas: ['report', '3'],
    };
    const allowed = mapping[activeFilter];
    return valid.filter((d) => allowed.includes(String(d?.documentType ?? '').toLowerCase()));
  }, [documents, activeFilter]);

  return (
    <ErrorBoundary>
      <View style={s.container}>
        {loading ? (
          <View style={s.loadingWrap}>
            <SkeletonList count={5} />
          </View>
        ) : error ? (
          <View style={s.errorWrap}>
            <AppEmptyState
              icon="alert-circle-outline"
              title="Não foi possível carregar"
              subtitle="Verifique sua conexão e tente novamente"
            />
            <Pressable style={s.retryBtn} onPress={() => load()}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : (
          <FadeIn visible={!loading} {...motionTokens.fade.patientRecord}>
        <ScrollView
          style={s.container}
          contentContainerStyle={{ paddingBottom: listPadding }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <LinearGradient
            colors={gradients.patientHeader as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.header, { paddingTop: insets.top + 12 }]}
          >
            <View style={s.headerRow}>
              <View style={s.headerTextCol}>
                <Text style={s.headerLabel}>Meu Prontuário</Text>
                <Text style={s.headerName} numberOfLines={1}>
                  {firstName}
                </Text>
                <Text style={s.headerSubtitle} numberOfLines={2}>
                  Atendimentos, receitas e exames
                </Text>
              </View>
              <View style={s.avatarCircle}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
            </View>
          </LinearGradient>

          <AppSegmentedControl
            items={TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
            value={activeTab}
            onValueChange={(value) => {
              haptics.selection();
              setActiveTab(value as TabKey);
            }}
          />

          {(activeTab === 'timeline' || activeTab === 'documentos') && (
            <AppSegmentedControl
              items={FILTER_CHIPS.map((chip) => ({ key: chip.key, label: chip.label }))}
              value={activeFilter}
              onValueChange={(value) => {
                haptics.selection();
                setActiveFilter(value as FilterChip);
              }}
              scrollable
            />
          )}

          {activeTab === 'resumo' && (
            <SummaryTab summary={summary} router={router} />
          )}
          {activeTab === 'timeline' && (
            <TimelineTab encounters={filteredEncounters} />
          )}
          {activeTab === 'documentos' && (
            <DocumentsTab documents={filteredDocuments} router={router} />
          )}

          <View style={s.legalNote}>
            <Ionicons name="shield-checkmark" size={16} color={colors.textMuted} />
            <Text style={s.legalText}>
              Este resumo é gerado a partir das consultas, receitas e exames feitos pelo
              RenoveJá+. Para fins oficiais, use sempre os PDFs assinados digitalmente.
            </Text>
          </View>
        </ScrollView>
          </FadeIn>
        )}
      </View>
    </ErrorBoundary>
  );
}

function SummaryTab({
  summary,
  router,
}: {
  summary: PatientSummaryDto | null;
  router: ReturnType<typeof useRouter>;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <>
      <View style={s.statsRow}>
        <StatCard
          icon="analytics"
          label="Pedidos"
          value={summary?.stats?.totalRequests ?? 0}
          color={colors.primary}
          bgColor={colors.primarySoft}
        />
        <StatCard
          icon="document-text"
          label="Receitas"
          value={summary?.stats?.totalPrescriptions ?? 0}
          color={colors.success}
          bgColor={colors.successLight}
        />
      </View>
      <View style={s.statsRow}>
        <StatCard
          icon="flask"
          label="Exames"
          value={summary?.stats?.totalExams ?? 0}
          color={colors.info}
          bgColor={colors.infoLight}
        />
        <StatCard
          icon="videocam"
          label="Consultas"
          value={summary?.stats?.totalConsultations ?? 0}
          color={colors.accent}
          bgColor={colors.accentSoft}
        />
      </View>

      {summary?.stats?.lastConsultationDate && (() => {
        try {
          const d = new Date(summary!.stats!.lastConsultationDate!);
          if (Number.isNaN(d.getTime())) return null;
          return (
            <View style={s.lastConsultWrap}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={s.lastConsultText}>
                Última consulta: {d.toLocaleDateString('pt-BR')}
                {summary!.stats!.lastConsultationDaysAgo != null &&
                  ` · há ${summary!.stats!.lastConsultationDaysAgo} dia(s)`}
              </Text>
            </View>
          );
        } catch {
          return null;
        }
      })()}

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <View style={[s.sectionIconCircle, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="medical" size={18} color={colors.accent} />
          </View>
          <View style={s.sectionHeaderText}>
            <Text style={s.sectionTitle}>Medicamentos recentes</Text>
            <Text style={s.sectionHint}>Extraídos das suas receitas emitidas</Text>
          </View>
        </View>
        {(summary?.medications?.length ?? 0) > 0 ? (
          <View style={s.listWrap}>
            {(summary?.medications ?? []).map((m, idx) => (
              <View key={`med-${idx}`} style={s.listItem}>
                <View style={[s.listDot, { backgroundColor: colors.accent }]} />
                <Text style={s.listItemText}>{String(m ?? '')}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.emptySection}>
            <Ionicons name="leaf-outline" size={20} color={colors.textMuted} />
            <Text style={s.emptySectionText}>
              Nenhum medicamento registrado ainda
            </Text>
          </View>
        )}
      </View>

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <View style={[s.sectionIconCircle, { backgroundColor: colors.infoLight }]}>
            <Ionicons name="flask" size={18} color={colors.info} />
          </View>
          <View style={s.sectionHeaderText}>
            <Text style={s.sectionTitle}>Exames recentes</Text>
            <Text style={s.sectionHint}>Solicitados pelo app</Text>
          </View>
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
            <Ionicons name="flask-outline" size={20} color={colors.textMuted} />
            <Text style={s.emptySectionText}>Nenhum exame registrado ainda</Text>
          </View>
        )}
      </View>

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
          <Text style={s.actionTitle}>Ver histórico completo</Text>
          <Text style={s.actionSubtitle}>Todos os seus pedidos e documentos</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </>
  );
}

function TimelineTab({ encounters }: { encounters: EncounterSummaryDto[] }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const ENCOUNTER_META = useMemo(() => getEncounterMeta(colors), [colors]);

  const validEncounters = (encounters ?? []).filter((e): e is EncounterSummaryDto => e != null && typeof e === 'object');
  if (!validEncounters.length) {
    return (
      <View style={s.tabEmptyWrap}>
        <AppEmptyState
          icon="time-outline"
          title="Nenhum atendimento"
          subtitle="Seus atendimentos aparecerão aqui"
        />
      </View>
    );
  }

  const sorted = [...validEncounters].sort((a, b) => {
    const ta = new Date(a?.startedAt ?? 0).getTime();
    const tb = new Date(b?.startedAt ?? 0).getTime();
    if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
    return tb - ta;
  });

  return (
    <View style={s.timelineContainer}>
      {sorted.map((enc, idx) => {
        const typeKey = String(enc?.type ?? '').toLowerCase();
        const meta = ENCOUNTER_META[typeKey] ?? {
          icon: 'ellipse' as const,
          color: colors.textMuted,
          bg: colors.surfaceSecondary,
          label: String(enc?.type ?? ''),
        };
        const isLast = idx === sorted.length - 1;
        const encId = enc?.id != null ? String(enc.id) : `enc-${idx}`;

        return (
          <View key={encId} style={s.timelineRow}>
            <View style={s.timelineLineCol}>
              <View style={[s.timelineDot, { backgroundColor: meta.color }]}>
                <Ionicons name={meta.icon} size={14} color={colors.white} />
              </View>
              {!isLast && <View style={s.timelineLine} />}
            </View>
            <View style={[s.timelineCard, isLast && { marginBottom: 0 }]}>
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
              <View style={s.timelineStatusRow}>
                <View
                  style={[
                    s.timelineStatusDot,
                    { backgroundColor: enc?.finishedAt ? colors.success : colors.warning },
                  ]}
                />
                <Text style={s.timelineStatusText}>
                  {enc?.finishedAt ? 'Concluído' : 'Em andamento'}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function DocumentsTab({ documents, router }: { documents: MedicalDocumentSummaryDto[]; router: ReturnType<typeof useRouter> }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const DOC_TYPE_META = useMemo(() => getDocTypeMeta(colors), [colors]);
  const DOC_STATUS_META = useMemo(() => getDocStatusMeta(colors), [colors]);

  if (!documents.length) {
    return (
      <View style={s.tabEmptyWrap}>
        <AppEmptyState
          icon="document-text-outline"
          title="Nenhum documento"
          subtitle="Seus documentos médicos aparecerão aqui"
        />
      </View>
    );
  }

  const sorted = [...documents].sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );

  return (
    <View style={s.docsContainer}>
      {sorted.map((doc, idx) => {
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

        return (
          <View key={doc.id ?? `doc-${idx}`} style={s.docCard}>
            <View style={[s.docIconWrap, { backgroundColor: typeMeta.bg }]}>
              <Ionicons name={typeMeta.icon} size={20} color={typeMeta.color} />
            </View>
            <View style={s.docContent}>
              <Text style={s.docTitle}>{typeMeta.label}</Text>
              <Text style={s.docDate}>{formatDatePt(doc.createdAt)}</Text>
              <View style={[s.docStatusBadge, { backgroundColor: statusMeta.bg }]}>
                <View
                  style={[s.docStatusDot, { backgroundColor: statusMeta.color }]}
                />
                <Text style={[s.docStatusText, { color: statusMeta.color }]}>
                  {statusMeta.label}
                </Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [
                s.docActionBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                Alert.alert(
                  typeMeta.label,
                  `Documento ${statusMeta.label.toLowerCase()} em ${formatDatePt(doc.createdAt)}.\n\nPara baixar o PDF assinado, acesse a tela de Pedidos e localize o pedido correspondente.`,
                  [{ text: 'OK' }, { text: 'Ir para Pedidos', onPress: () => router.push('/(patient)/requests') }]
                );
              }}
            >
              <Ionicons name="eye-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function StatCard(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.statCard}>
      <View style={[s.statIconWrap, { backgroundColor: props.bgColor }]}>
        <Ionicons name={props.icon} size={18} color={props.color} />
      </View>
      <Text style={s.statValue}>{props.value}</Text>
      <Text style={s.statLabel}>{props.label}</Text>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingTop: 100,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: colors.primary,
    borderRadius: 26,
  },
  retryText: { fontSize: 15, fontWeight: '600', color: colors.white },

  header: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTextCol: { flex: 1, paddingRight: 12 },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.headerOverlayTextMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.headerOverlayText,
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.headerOverlayTextMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.headerOverlaySurface,
    borderWidth: 2,
    borderColor: colors.headerOverlayBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.headerOverlayText },

  segmentBar: {
    flexDirection: 'row',
    marginHorizontal: uiTokens.screenPaddingHorizontal,
    marginTop: 16,
    backgroundColor: colors.surface,
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

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.primary,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    ...shadows.card,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },

  lastConsultWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    marginTop: 12,
    marginBottom: 4,
  },
  lastConsultText: { fontSize: 12, color: colors.textMuted },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: uiTokens.screenPaddingHorizontal,
    marginTop: 16,
    ...shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
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
    marginTop: 1,
  },
  listWrap: { gap: 6 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  listDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 6,
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  emptySectionText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: uiTokens.screenPaddingHorizontal,
    marginTop: 16,
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
  actionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  actionSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  legalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: uiTokens.screenPaddingHorizontal + 4,
    paddingVertical: 20,
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },

  tabEmptyWrap: {
    paddingTop: 40,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },

  timelineContainer: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineLineCol: {
    width: 36,
    alignItems: 'center',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: -2,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginLeft: 10,
    marginBottom: 12,
    ...shadows.card,
  },
  timelineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  timelineTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timelineTypeText: {
    fontSize: 12,
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
    marginBottom: 6,
  },
  timelineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timelineStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineStatusText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },

  docsContainer: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    gap: 10,
    paddingTop: 4,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    ...shadows.card,
  },
  docIconWrap: {
    width: 44,
    height: 44,
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
    fontWeight: '600',
    color: colors.text,
  },
  docDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  docStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    gap: 4,
  },
  docStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  docStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  docActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  });
}
