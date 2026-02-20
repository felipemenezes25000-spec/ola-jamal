import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../lib/themeDoctor';
import { getPatientRequests } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { StatusBadge } from '../../components/StatusBadge';
import { DoctorHeader } from '../../components/ui/DoctorHeader';

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

  const id = Array.isArray(patientId) ? patientId[0] : patientId ?? '';

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getPatientRequests(id);
      setRequests(data);
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

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const patientName = requests[0]?.patientName ?? 'Paciente';
  const headerPaddingTop = insets.top + 8;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
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
              Último: {fmtDate(requests[0].createdAt)}
            </Text>
          )}
        </View>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Pedidos</Text>
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
        ) : (
          requests.map((req) => {
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
                  {req.aiSummaryForDoctor && (
                    <Text style={styles.timelineSummary} numberOfLines={2}>
                      {req.aiSummaryForDoctor}
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
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
