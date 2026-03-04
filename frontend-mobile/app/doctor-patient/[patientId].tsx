import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../lib/themeDoctor';
import { getPatientRequests, sortRequestsByNewestFirst } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { StatusBadge } from '../../components/StatusBadge';
import { DoctorHeader } from '../../components/ui/DoctorHeader';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { useTriageEval } from '../../hooks/useTriageEval';

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

export default function DoctorPatientProntuario() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const id = Array.isArray(patientId) ? patientId[0] : patientId ?? '';

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoadError(false);
      const data = await getPatientRequests(id);
      setRequests(data);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const sortedRequests = useMemo(() => sortRequestsByNewestFirst(requests), [requests]);

  const patientName = sortedRequests[0]?.patientName ?? 'Paciente';
  const headerPaddingTop = insets.top + 8;

  const [typeFilter, setTypeFilter] = useState<'all' | 'prescription' | 'exam' | 'consultation'>('all');

  const filteredRequests = useMemo(
    () =>
      sortedRequests.filter((r) =>
        typeFilter === 'all' ? true : r.requestType === typeFilter
      ),
    [sortedRequests, typeFilter]
  );

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
        <DoctorHeader title="Prontuário" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <SkeletonList count={5} />
        </View>
      </View>
    );
  }

  if (loadError && requests.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DoctorHeader title="Prontuário" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
          <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 16 }}>Erro ao carregar</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>Verifique sua conexão e tente novamente</Text>
          <TouchableOpacity
            onPress={loadData}
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
      <DoctorHeader
        title="Prontuário"
        subtitle={patientName}
        onBack={() => router.back()}
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
          {/* Resumo */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryIconWrap}>
                <Ionicons name="person" size={24} color={colors.primary} />
              </View>
              <View style={styles.summaryBody}>
                <Text style={styles.summaryLabel}>Total de pedidos</Text>
                <Text style={styles.summaryValue}>{requests.length}</Text>
              </View>
            </View>
            {requests.length > 0 && (
              <Text style={styles.lastRequest}>
              Último: {fmtDate(sortedRequests[0].createdAt)}
            </Text>
          )}
          {requests.length > 0 && (
            <TouchableOpacity
              style={styles.summaryLinkBtn}
              activeOpacity={0.7}
              onPress={() => router.push(`/doctor-patient-summary/${id}` as any)}
            >
              <Ionicons name="list-circle" size={18} color={colors.primary} />
              <Text style={styles.summaryLinkText}>Ver resumo clínico contínuo</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
          </View>

          {/* Timeline */}
          <Text style={styles.sectionTitle}>Pedidos</Text>

          {/* Filtros rápidos por tipo */}
          {requests.length > 0 && (
            <View style={styles.filterRow}>
              {([
                { key: 'all', label: 'Todos' },
                { key: 'consultation', label: 'Consultas' },
                { key: 'prescription', label: 'Receitas' },
                { key: 'exam', label: 'Exames' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.filterChip,
                    typeFilter === opt.key && styles.filterChipActive,
                  ]}
                  onPress={() => setTypeFilter(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      typeFilter === opt.key && styles.filterChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {requests.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="document-text-outline" size={44} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Nenhum pedido encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Este paciente ainda não possui histórico de pedidos
              </Text>
            </View>
          ) : filteredRequests.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="filter" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Nada para o filtro atual</Text>
              <Text style={styles.emptySubtitle}>
                Tente mudar o tipo selecionado acima para ver outros registros.
              </Text>
            </View>
          ) : (
            filteredRequests.map((req) => {
              const icon = TYPE_ICONS[req.requestType] || 'document';
              const color = TYPE_COLORS[req.requestType] || colors.primary;
              return (
                <TouchableOpacity
                  key={req.id}
                  style={styles.timelineCard}
                  onPress={() => router.push(`/doctor-request/${req.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.timelineIcon, { backgroundColor: color + '18' }]}>
                    <Ionicons name={icon} size={22} color={color} />
                  </View>
                  <View style={styles.timelineBody}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineType}>
                        {TYPE_LABELS[req.requestType] || req.requestType}
                      </Text>
                      <StatusBadge status={req.status} size="sm" />
                    </View>
                    <Text style={styles.timelineDate}>{fmtDate(req.createdAt)}</Text>
                    {req.requestType === 'consultation' && (req.consultationTranscript || req.consultationAnamnesis) && (
                      <View style={styles.transcriptBadge}>
                        <Ionicons name="document-text" size={12} color={colors.primary} />
                        <Text style={styles.transcriptBadgeText}>Transcrição e anamnese disponíveis</Text>
                      </View>
                    )}
                    {buildMiniSummary(req) && (
                      <Text style={styles.timelineSummary} numberOfLines={2}>
                        {buildMiniSummary(req)}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { marginRight: spacing.sm },
  headerText: { flex: 1 },
  patientName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 80,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  summaryBody: { flex: 1 },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  lastRequest: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  summaryLinkBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryLinkText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: '600',
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  timelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  timelineIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
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
  timelineDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  transcriptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  transcriptBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  timelineSummary: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
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
});
