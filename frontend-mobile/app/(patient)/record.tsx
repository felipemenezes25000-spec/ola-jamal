import React, { useState, useCallback, useMemo } from 'react';
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
import { colors, gradients, shadows } from '../../lib/theme';
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
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../contexts/AuthContext';

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

function formatDatePt(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS_PT[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

const ENCOUNTER_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  teleconsulta: { icon: 'videocam', color: '#0EA5E9', bg: '#E0F2FE', label: 'Teleconsulta' },
  consultation: { icon: 'videocam', color: '#0EA5E9', bg: '#E0F2FE', label: 'Consulta' },
  renovacao: { icon: 'refresh', color: '#10B981', bg: '#D1FAE5', label: 'Renovação' },
  prescription: { icon: 'medical', color: '#EC4899', bg: '#FCE7F3', label: 'Receita' },
  exame: { icon: 'flask', color: '#8B5CF6', bg: '#EDE9FE', label: 'Exame' },
  exam: { icon: 'flask', color: '#8B5CF6', bg: '#EDE9FE', label: 'Exame' },
};

const DOC_TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  prescription: { icon: 'medical', color: '#EC4899', bg: '#FCE7F3', label: 'Receita' },
  exam: { icon: 'flask', color: '#8B5CF6', bg: '#EDE9FE', label: 'Exame' },
  report: { icon: 'document-text', color: '#3B82F6', bg: '#DBEAFE', label: 'Laudo' },
  atestado: { icon: 'ribbon', color: '#F59E0B', bg: '#FEF3C7', label: 'Atestado' },
};

const DOC_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  signed: { color: '#059669', bg: '#D1FAE5', label: 'Assinado' },
  draft: { color: '#D97706', bg: '#FEF3C7', label: 'Rascunho' },
  cancelled: { color: '#6B7280', bg: '#F3F4F6', label: 'Cancelado' },
};

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

  const load = useCallback(async () => {
    try {
      setError(false);
      const [summaryData, encountersData, documentsData] = await Promise.all([
        fetchMyPatientSummary(),
        fetchMyEncounters().catch(() => [] as EncounterSummaryDto[]),
        fetchMyDocuments().catch(() => [] as MedicalDocumentSummaryDto[]),
      ]);
      setSummary(summaryData);
      setEncounters(encountersData);
      setDocuments(documentsData);
    } catch {
      setError(true);
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const firstName =
    summary?.name?.full?.split(' ')[0] ?? user?.name?.split(' ')[0] ?? 'Paciente';
  const initials = (summary?.name?.full ?? user?.name ?? 'P')
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase())
    .join('');

  const filteredEncounters = useMemo(() => {
    if (activeFilter === 'todos') return encounters;
    const mapping: Record<FilterChip, string[]> = {
      todos: [],
      receitas: ['prescription', 'renovacao'],
      exames: ['exam', 'exame'],
      consultas: ['teleconsulta', 'consultation'],
    };
    const allowed = mapping[activeFilter];
    return encounters.filter((e) => allowed.includes(e.type.toLowerCase()));
  }, [encounters, activeFilter]);

  const filteredDocuments = useMemo(() => {
    if (activeFilter === 'todos') return documents;
    const mapping: Record<FilterChip, string[]> = {
      todos: [],
      receitas: ['prescription'],
      exames: ['exam'],
      consultas: ['report'],
    };
    const allowed = mapping[activeFilter];
    return documents.filter((d) => allowed.includes(d.documentType.toLowerCase()));
  }, [documents, activeFilter]);

  return (
    <View style={s.container}>
      {loading ? (
        <View style={s.loadingWrap}>
          <SkeletonList count={5} />
        </View>
      ) : error ? (
        <View style={s.errorWrap}>
          <EmptyState
            icon="alert-circle-outline"
            title="Não foi possível carregar"
            subtitle="Verifique sua conexão e tente novamente"
          />
          <Pressable style={s.retryBtn} onPress={load}>
            <Text style={s.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <FadeIn visible={!loading} duration={300}>
        <ScrollView
          style={s.container}
          contentContainerStyle={{ paddingBottom: listPadding }}
          showsVerticalScrollIndicator={false}
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
                  Resumo dos seus atendimentos, receitas e exames no RenoveJá+
                </Text>
              </View>
              <View style={s.avatarCircle}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={s.segmentBar}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[s.segmentItem, active && s.segmentItemActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={active ? colors.primary : colors.textMuted}
                  />
                  <Text style={[s.segmentLabel, active && s.segmentLabelActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {(activeTab === 'timeline' || activeTab === 'documentos') && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterRow}
            >
              {FILTER_CHIPS.map((chip) => {
                const active = activeFilter === chip.key;
                return (
                  <Pressable
                    key={chip.key}
                    style={[s.filterChip, active && s.filterChipActive]}
                    onPress={() => setActiveFilter(chip.key)}
                  >
                    <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
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
  );
}

function SummaryTab({
  summary,
  router,
}: {
  summary: PatientSummaryDto | null;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      <View style={s.statsRow}>
        <StatCard
          icon="analytics"
          label="Pedidos"
          value={summary?.stats.totalRequests ?? 0}
          color={colors.primary}
          bgColor="#E3F4FF"
        />
        <StatCard
          icon="document-text"
          label="Receitas"
          value={summary?.stats.totalPrescriptions ?? 0}
          color={colors.success}
          bgColor="#D1FAE5"
        />
      </View>
      <View style={s.statsRow}>
        <StatCard
          icon="flask"
          label="Exames"
          value={summary?.stats.totalExams ?? 0}
          color={colors.info}
          bgColor="#DBEAFE"
        />
        <StatCard
          icon="videocam"
          label="Consultas"
          value={summary?.stats.totalConsultations ?? 0}
          color={colors.accent}
          bgColor="#EDE9FE"
        />
      </View>

      {summary?.stats.lastConsultationDate && (
        <View style={s.lastConsultWrap}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={s.lastConsultText}>
            Última consulta:{' '}
            {new Date(summary.stats.lastConsultationDate).toLocaleDateString('pt-BR')}
            {summary.stats.lastConsultationDaysAgo != null &&
              ` · há ${summary.stats.lastConsultationDaysAgo} dia(s)`}
          </Text>
        </View>
      )}

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <View style={[s.sectionIconCircle, { backgroundColor: '#FCE7F3' }]}>
            <Ionicons name="medical" size={18} color="#EC4899" />
          </View>
          <View style={s.sectionHeaderText}>
            <Text style={s.sectionTitle}>Medicamentos recentes</Text>
            <Text style={s.sectionHint}>Extraídos das suas receitas emitidas</Text>
          </View>
        </View>
        {summary?.medications?.length ? (
          <View style={s.listWrap}>
            {summary.medications.map((m, idx) => (
              <View key={idx} style={s.listItem}>
                <View style={[s.listDot, { backgroundColor: '#EC4899' }]} />
                <Text style={s.listItemText}>{m}</Text>
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
          <View style={[s.sectionIconCircle, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="flask" size={18} color={colors.info} />
          </View>
          <View style={s.sectionHeaderText}>
            <Text style={s.sectionTitle}>Exames recentes</Text>
            <Text style={s.sectionHint}>Solicitados pelo app</Text>
          </View>
        </View>
        {summary?.exams?.length ? (
          <View style={s.listWrap}>
            {summary.exams.map((e, idx) => (
              <View key={idx} style={s.listItem}>
                <View style={[s.listDot, { backgroundColor: colors.info }]} />
                <Text style={s.listItemText}>{e}</Text>
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
  if (!encounters.length) {
    return (
      <View style={s.tabEmptyWrap}>
        <EmptyState
          icon="time-outline"
          title="Nenhum atendimento"
          subtitle="Seus atendimentos aparecerão aqui"
        />
      </View>
    );
  }

  const sorted = [...encounters].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  return (
    <View style={s.timelineContainer}>
      {sorted.map((enc, idx) => {
        const meta = ENCOUNTER_META[enc.type.toLowerCase()] ?? {
          icon: 'ellipse' as const,
          color: colors.textMuted,
          bg: '#F1F5F9',
          label: enc.type,
        };
        const isLast = idx === sorted.length - 1;

        return (
          <View key={enc.id} style={s.timelineRow}>
            <View style={s.timelineLineCol}>
              <View style={[s.timelineDot, { backgroundColor: meta.color }]}>
                <Ionicons name={meta.icon} size={14} color="#fff" />
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
                <Text style={s.timelineDate}>{formatDatePt(enc.startedAt)}</Text>
              </View>
              {enc.mainIcd10Code && (
                <Text style={s.timelineDescription} numberOfLines={2}>
                  {enc.mainIcd10Code}
                </Text>
              )}
              <View style={s.timelineStatusRow}>
                <View
                  style={[
                    s.timelineStatusDot,
                    { backgroundColor: enc.finishedAt ? '#10B981' : '#F59E0B' },
                  ]}
                />
                <Text style={s.timelineStatusText}>
                  {enc.finishedAt ? 'Concluído' : 'Em andamento'}
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
  if (!documents.length) {
    return (
      <View style={s.tabEmptyWrap}>
        <EmptyState
          icon="document-text-outline"
          title="Nenhum documento"
          subtitle="Seus documentos médicos aparecerão aqui"
        />
      </View>
    );
  }

  const sorted = [...documents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <View style={s.docsContainer}>
      {sorted.map((doc) => {
        const typeMeta = DOC_TYPE_META[doc.documentType.toLowerCase()] ?? {
          icon: 'document-outline' as const,
          color: '#6B7280',
          bg: '#F3F4F6',
          label: doc.documentType,
        };
        const statusMeta = DOC_STATUS_META[doc.status.toLowerCase()] ?? {
          color: '#6B7280',
          bg: '#F3F4F6',
          label: doc.status,
        };

        return (
          <View key={doc.id} style={s.docCard}>
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

const s = StyleSheet.create({
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
  retryText: { fontSize: 15, fontWeight: '600', color: '#fff' },

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
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    lineHeight: 18,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },

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
    fontSize: 11,
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
    fontSize: 11,
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
