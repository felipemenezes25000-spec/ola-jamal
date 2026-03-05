import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../lib/themeDoctor';
import { getPatientRequests, sortRequestsByNewestFirst } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { AppSegmentedControl, AppEmptyState } from '../../components/ui';
import { useTriageEval } from '../../hooks/useTriageEval';
import { getStatusLabelPt } from '../../lib/domain/statusLabels';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';

const TYPE_LABELS: Record<string, string> = {
  prescription: 'Receita',
  exam: 'Exame',
  consultation: 'Consulta',
};

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  prescription: 'document-text',
  exam: 'flask',
  consultation: 'videocam',
};

const TYPE_COLORS: Record<string, string> = {
  prescription: colors.primary,
  exam: colors.info,
  consultation: colors.success,
};

function fmtDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtHour(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeDateLabel(d: string): string {
  return fmtDate(d).replace('.', '');
}

const TYPE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'consultation', label: 'Consultas' },
  { key: 'prescription', label: 'Receitas' },
  { key: 'exam', label: 'Exames' },
] as const;

const PERIOD_FILTERS = [
  { key: 'all', label: 'Todo período' },
  { key: '7d', label: 'Últimos 7 dias' },
  { key: '30d', label: 'Últimos 30 dias' },
  { key: '90d', label: 'Últimos 90 dias' },
] as const;

type TypeFilterKey = (typeof TYPE_FILTERS)[number]['key'];
type PeriodFilterKey = (typeof PERIOD_FILTERS)[number]['key'];

const CLOSED_STATUSES = new Set([
  'consultation_finished',
  'delivered',
  'signed',
  'completed',
  'cancelled',
  'rejected',
]);

function getStatusTone(status: string | null | undefined): { label: string; color: string } {
  const key = (status ?? '').toLowerCase();
  if (key === 'consultation_finished') return { label: 'Finalizada', color: colors.textMuted };
  if (key === 'paid') return { label: 'Pago', color: '#3B82F6' };
  if (key === 'delivered') return { label: 'Entregue', color: colors.success };
  return { label: getStatusLabelPt(key), color: colors.textMuted };
}

export default function DoctorPatientProntuario() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const id = Array.isArray(patientId) ? patientId[0] : patientId ?? '';

  const loadData = useCallback(async (withFeedback = false) => {
    if (!id) return;
    try {
      setLoadError(false);
      const data = await getPatientRequests(id);
      setRequests(data);
      if (withFeedback) {
        showToast({ message: 'Prontuário atualizado', type: 'success' });
      }
    } catch (e) {
      console.error(e);
      setLoadError(true);
      if (withFeedback) {
        showToast({ message: 'Não foi possível atualizar o prontuário', type: 'error' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    haptics.light();
    setRefreshing(true);
    loadData(true);
  };

  const sortedRequests = useMemo(() => sortRequestsByNewestFirst(requests), [requests]);

  const patientName = sortedRequests[0]?.patientName ?? 'Paciente';

  const [typeFilter, setTypeFilter] = useState<TypeFilterKey>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterKey>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const typeCounts = useMemo(() => {
    const all = sortedRequests.length;
    const consultation = sortedRequests.filter((r) => r.requestType === 'consultation').length;
    const prescription = sortedRequests.filter((r) => r.requestType === 'prescription').length;
    const exam = sortedRequests.filter((r) => r.requestType === 'exam').length;
    return { all, consultation, prescription, exam };
  }, [sortedRequests]);

  const statusOptions = useMemo(() => {
    const statusMap = new Map<string, string>();
    sortedRequests.forEach((req) => {
      const key = (req.status ?? '').toLowerCase();
      if (!statusMap.has(key)) {
        statusMap.set(key, getStatusLabelPt(key));
      }
    });
    return Array.from(statusMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [sortedRequests]);

  const hasAdvancedFilters = statusFilter !== 'all' || periodFilter !== 'all';

  const filteredRequests = useMemo(() => {
    const now = Date.now();
    const periodLimitMs: Record<Exclude<PeriodFilterKey, 'all'>, number> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    };

    return sortedRequests.filter((r) => {
      if (typeFilter !== 'all' && r.requestType !== typeFilter) return false;
      if (statusFilter !== 'all' && (r.status ?? '').toLowerCase() !== statusFilter) return false;
      if (periodFilter !== 'all') {
        const ageMs = now - new Date(r.createdAt).getTime();
        if (ageMs > periodLimitMs[periodFilter]) return false;
      }
      return true;
    });
  }, [sortedRequests, typeFilter, statusFilter, periodFilter]);

  function buildMiniSummary(req: RequestResponseDto): string | null {
    if (req.requestType === 'consultation') {
      if (req.symptoms && req.symptoms.trim().length > 0) {
        return req.symptoms.trim();
      }
      if (req.doctorConductNotes && req.doctorConductNotes.trim().length > 0) {
        return req.doctorConductNotes.trim();
      }
      if (req.aiSummaryForDoctor && req.aiSummaryForDoctor.trim().length > 0) {
        return req.aiSummaryForDoctor.trim();
      }
      return null;
    }
    if (req.requestType === 'prescription') {
      const meds = req.medications ?? [];
      if (!meds.length) return null;
      const first = meds[0];
      const extra = meds.length > 1 ? ` (+${meds.length - 1} med.)` : '';
      const kind =
        req.prescriptionKind === 'antimicrobial'
          ? ' · Antimicrobiana'
          : req.prescriptionKind === 'controlled_special'
          ? ' · Controle especial'
          : '';
      return `${first}${extra}${kind}`;
    }
    if (req.requestType === 'exam') {
      const exams = req.exams ?? [];
      if (!exams.length) return null;
      const first = exams[0];
      const extra = exams.length > 1 ? ` (+${exams.length - 1} exames)` : '';
      return `${first}${extra}`;
    }
    return null;
  }

  // Estatísticas de uso do app pelo paciente (para Dra. Renova médico)
  const totalRequests = requests.length;
  const last6Months = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return requests.filter(r => new Date(r.createdAt) >= cutoff);
  }, [requests]);
  const recentPrescriptionCount = useMemo(
    () => last6Months.filter(r => r.requestType === 'prescription').length,
    [last6Months]
  );
  const recentExamCount = useMemo(
    () => last6Months.filter(r => r.requestType === 'exam').length,
    [last6Months]
  );
  const lastConsultationDays = useMemo(() => {
    const cons = requests.filter(r => r.requestType === 'consultation');
    if (cons.length === 0) return undefined;
    const latest = cons.reduce((acc, cur) =>
      new Date(cur.createdAt) > new Date(acc.createdAt) ? cur : acc
    );
    return Math.floor(
      (Date.now() - new Date(latest.createdAt).getTime()) / (24 * 60 * 60 * 1000)
    );
  }, [requests]);

  const pendingRequests = useMemo(
    () => requests.filter((r) => !CLOSED_STATUSES.has((r.status ?? '').toLowerCase())).length,
    [requests]
  );

  const groupedRequests = useMemo(() => {
    const groups: Array<{ dateLabel: string; items: RequestResponseDto[] }> = [];
    const groupIndex = new Map<string, number>();

    filteredRequests.forEach((req) => {
      const dateLabel = normalizeDateLabel(req.createdAt);
      const existingIndex = groupIndex.get(dateLabel);
      if (existingIndex == null) {
        groupIndex.set(dateLabel, groups.length);
        groups.push({ dateLabel, items: [req] });
      } else {
        groups[existingIndex].items.push(req);
      }
    });

    return groups;
  }, [filteredRequests]);

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
        <CompactHeader
          title="Prontuário"
          subtitle={patientName}
          topInset={insets.top}
          onBack={() => router.back()}
          onHelpPress={() => router.push('/help-faq')}
        />
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <SkeletonList count={5} />
        </View>
      </View>
    );
  }

  if (loadError && requests.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <CompactHeader
          title="Prontuário"
          subtitle={patientName}
          topInset={insets.top}
          onBack={() => router.back()}
          onHelpPress={() => router.push('/help-faq')}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
          <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 16 }}>Erro ao carregar</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>Verifique sua conexão e tente novamente</Text>
          <TouchableOpacity
            onPress={() => loadData()}
            style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 28, backgroundColor: colors.primary, borderRadius: 26 }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CompactHeader
        title="Prontuário"
        subtitle={patientName}
        topInset={insets.top}
        onBack={() => router.back()}
        onHelpPress={() => router.push('/help-faq')}
      />
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryBar}>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryMetricLabel}>Pedidos</Text>
              <Text style={styles.summaryMetricValue}>{requests.length}</Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryMetricLabel}>Último</Text>
              <Text style={styles.summaryMetricValueSmall}>
                {requests.length > 0 ? normalizeDateLabel(sortedRequests[0].createdAt) : '--'}
              </Text>
            </View>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryMetricLabel}>Pendentes</Text>
              <Text style={styles.summaryMetricValue}>{pendingRequests}</Text>
            </View>
          </View>

          {requests.length > 0 && (
            <TouchableOpacity
              style={styles.summaryLinkBtn}
              activeOpacity={0.7}
              onPress={() => router.push(`/doctor-patient-summary/${id}` as any)}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <Text style={styles.summaryLinkText}>Ver resumo clínico</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>Pedidos</Text>

          {requests.length > 0 && (
            <View style={styles.filterControlsRow}>
              <View style={styles.segmentedControl}>
                <AppSegmentedControl
                  items={TYPE_FILTERS.map((opt) => ({
                    key: opt.key,
                    label: opt.label,
                    count: (typeCounts as any)[opt.key] ?? undefined,
                  }))}
                  value={typeFilter}
                  onValueChange={(value) => {
                    haptics.selection();
                    setTypeFilter(value as TypeFilterKey);
                  }}
                  size="sm"
                />
              </View>
              <TouchableOpacity
                style={[styles.filterIconBtn, hasAdvancedFilters && styles.filterIconBtnActive]}
                activeOpacity={0.7}
                onPress={() => {
                  haptics.selection();
                  setShowAdvancedFilters(true);
                }}
                accessibilityLabel="Filtros avançados"
              >
                <Ionicons
                  name="funnel-outline"
                  size={18}
                  color={hasAdvancedFilters ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}

          {requests.length === 0 ? (
            <View style={styles.empty}>
              <AppEmptyState
                icon="document-text-outline"
                title="Nenhum pedido encontrado"
                subtitle="Este paciente ainda não possui histórico de pedidos"
              />
            </View>
          ) : filteredRequests.length === 0 ? (
            <View style={styles.empty}>
              <AppEmptyState
                icon="filter"
                title="Nada para o filtro atual"
                subtitle="Tente ajustar tipo, status ou período para ver outros registros."
              />
            </View>
          ) : (
            groupedRequests.map((group) => (
              <View key={group.dateLabel} style={styles.dateGroup}>
                <Text style={styles.dateGroupTitle}>{group.dateLabel}</Text>
                <View style={styles.dateGroupList}>
                  {group.items.map((req, idx) => {
                    const icon = TYPE_ICONS[req.requestType] || 'document';
                    const color = TYPE_COLORS[req.requestType] || colors.primary;
                    const statusTone = getStatusTone(req.status);
                    const itemSummary = buildMiniSummary(req) ?? 'Sem observações registradas';
                    const isLast = idx === group.items.length - 1;
                    return (
                      <TouchableOpacity
                        key={req.id}
                        style={[styles.timelineRowItem, !isLast && styles.timelineRowDivider]}
                        onPress={() => {
                          haptics.selection();
                          router.push(`/doctor-request/${req.id}`);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.timelineIcon, { backgroundColor: color + '14' }]}>
                          <Ionicons name={icon} size={18} color={color} />
                        </View>
                        <View style={styles.timelineBody}>
                          <View style={styles.timelineHeader}>
                            <Text style={styles.timelineType}>
                              {TYPE_LABELS[req.requestType] || req.requestType}
                            </Text>
                            <View style={styles.statusInline}>
                              <View
                                style={[
                                  styles.statusInlineDot,
                                  { backgroundColor: statusTone.color },
                                ]}
                              />
                              <Text style={[styles.statusInlineText, { color: statusTone.color }]}>
                                {statusTone.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.timelineMeta} numberOfLines={1}>
                            {fmtHour(req.createdAt)} · {itemSummary}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
      <Modal
        visible={showAdvancedFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdvancedFilters(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowAdvancedFilters(false)}
          />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filtros</Text>
              <TouchableOpacity
                onPress={() => setShowAdvancedFilters(false)}
                style={styles.sheetCloseBtn}
                accessibilityLabel="Fechar filtros"
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetSectionTitle}>Status</Text>
            <View style={styles.sheetPillsWrap}>
              <TouchableOpacity
                style={[
                  styles.sheetPill,
                  statusFilter === 'all' && styles.sheetPillActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  setStatusFilter('all');
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sheetPillText,
                    statusFilter === 'all' && styles.sheetPillTextActive,
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>
              {statusOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.sheetPill,
                    statusFilter === opt.key && styles.sheetPillActive,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setStatusFilter(opt.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sheetPillText,
                      statusFilter === opt.key && styles.sheetPillTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sheetSectionTitle}>Período</Text>
            <View style={styles.sheetPeriodList}>
              {PERIOD_FILTERS.map((opt, idx) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.sheetPeriodItem,
                    idx === PERIOD_FILTERS.length - 1 && styles.sheetPeriodItemLast,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setPeriodFilter(opt.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sheetPeriodText}>{opt.label}</Text>
                  <View
                    style={[
                      styles.radioOuter,
                      periodFilter === opt.key && styles.radioOuterActive,
                    ]}
                  >
                    {periodFilter === opt.key ? <View style={styles.radioInner} /> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={() => {
                  haptics.selection();
                  setStatusFilter('all');
                  setPeriodFilter('all');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.clearFiltersText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyFiltersBtn}
                onPress={() => {
                  haptics.selection();
                  setShowAdvancedFilters(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.applyFiltersText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CompactHeader({
  title,
  subtitle,
  topInset,
  onBack,
  onHelpPress,
}: {
  title: string;
  subtitle?: string;
  topInset: number;
  onBack: () => void;
  onHelpPress?: () => void;
}) {
  return (
    <View style={[styles.compactHeader, { paddingTop: topInset + 8 }]}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.compactBackBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Voltar"
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.compactHeaderText}>
        <Text style={styles.compactHeaderTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.compactHeaderSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onHelpPress ? (
        <TouchableOpacity
          onPress={onHelpPress}
          style={styles.compactHelpBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Tire dúvidas com a Dra. Renoveja"
        >
          <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.compactHeaderPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  compactHeader: {
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  compactBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  compactHeaderText: {
    flex: 1,
    paddingHorizontal: 10,
  },
  compactHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  compactHeaderSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 1,
  },
  compactHeaderPlaceholder: {
    width: 36,
  },
  compactHelpBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 80,
  },
  summaryBar: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryMetric: {
    flex: 1,
    minWidth: 0,
  },
  summaryMetricLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryMetricValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 1,
  },
  summaryMetricValueSmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  summaryLinkBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.md,
    paddingVertical: 2,
  },
  summaryLinkText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: '600',
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  segmentedControl: {
    flex: 1,
  },
  segmentedItem: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedItemActive: {
    backgroundColor: colors.primarySoft,
  },
  segmentedItemText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  segmentedItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  filterIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconBtnActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  dateGroup: {
    marginBottom: spacing.md,
  },
  dateGroupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  dateGroupList: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  timelineRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timelineRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  timelineIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  timelineBody: { flex: 1, minWidth: 0 },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  timelineType: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    flexShrink: 1,
  },
  statusInlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusInlineText: {
    fontSize: 12,
    fontWeight: '500',
  },
  timelineMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
  },
  sheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md + 10,
    paddingTop: 8,
    gap: 10,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  sheetSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  sheetPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  sheetPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  sheetPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sheetPillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  sheetPeriodList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  sheetPeriodItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetPeriodItemLast: {
    borderBottomWidth: 0,
  },
  sheetPeriodText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 10,
  },
  clearFiltersBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  applyFiltersBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFiltersText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
