import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography, gradients, doctorDS } from '../../lib/themeDoctor';
const pad = doctorDS.screenPaddingHorizontal;
import { getRequests, getActiveCertificate } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { StatsCard } from '../../components/StatsCard';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { DoctorCard } from '../../components/ui/DoctorCard';
import {
  countNaFila,
  countConsultaPronta,
  countEmConsulta,
  countPendentes,
  getPendingForPanel,
  getRequestUiState,
  UI_STATUS_COLORS,
} from '../../lib/domain/getRequestUiState';

const TYPE_LABELS: Record<string, string> = {
  prescription: 'Receita',
  exam: 'Exame',
  consultation: 'Consulta',
};

function getShortSummary(request: RequestResponseDto): string {
  if (request.requestType === 'prescription' && request.medications?.length) {
    const first = request.medications[0];
    return request.medications.length > 1 ? `${first} +${request.medications.length - 1}` : first;
  }
  if (request.requestType === 'exam' && request.exams?.length) {
    const first = request.exams[0];
    return request.exams.length > 1 ? `${first} +${request.exams.length - 1}` : first;
  }
  if (request.requestType === 'consultation' && request.symptoms) {
    return request.symptoms.length > 40 ? request.symptoms.slice(0, 40) + '…' : request.symptoms;
  }
  return '—';
}

function getActionButtonLabel(request: RequestResponseDto): string {
  if (request.status === 'in_consultation') return 'Entrar';
  return 'Abrir';
}

export default function DoctorDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [queue, setQueue] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCertificate, setHasCertificate] = useState<boolean | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [cert, res] = await Promise.allSettled([
        getActiveCertificate(),
        getRequests({ page: 1, pageSize: 50 }),
      ]);
      setHasCertificate(cert.status === 'fulfilled' && !!cert.value);
      setQueue(res.status === 'fulfilled' ? (res.value?.items ?? (res.value as { Items?: unknown[] })?.Items ?? []) : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useFocusEffect(
    useCallback(() => {
      loadData();
      const interval = setInterval(loadData, 45000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const pendentesCount = countPendentes(queue);
  const naFila = countNaFila(queue);
  const consultaPronta = countConsultaPronta(queue);
  const emConsulta = countEmConsulta(queue);
  const pendingList = getPendingForPanel(queue, 10);

  const firstName = user?.name?.split(' ')[0] || 'Médico';
  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header: gradiente oficial #157AB5 → #2F9BDB */}
      <LinearGradient
        colors={[...gradients.doctorHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.headerTextWrap}>
          <Text style={styles.greeting}>{greeting}, Dr(a). {firstName}</Text>
          <Text style={styles.pendingSummary}>
            Você tem {pendentesCount} atendimento{pendentesCount !== 1 ? 's' : ''} pendente{pendentesCount !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Apenas 3 cards: Na fila, Consulta pronta, Em consulta */}
        <View style={styles.statsRow}>
          <StatsCard
            icon="time-outline"
            label="Na fila"
            value={naFila}
            iconColor="#D97706"
            onPress={() => router.push('/(doctor)/requests')}
          />
          <StatsCard
            icon="videocam-outline"
            label="Consulta pronta"
            value={consultaPronta}
            iconColor={colors.primary}
            onPress={() => router.push('/(doctor)/requests')}
          />
          <StatsCard
            icon="checkmark-circle-outline"
            label="Em consulta"
            value={emConsulta}
            iconColor="#059669"
            onPress={() => router.push('/(doctor)/requests')}
          />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {hasCertificate === false && (
          <Pressable
            style={({ pressed }) => [styles.alertBanner, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/certificate/upload')}
          >
            <View style={styles.alertIconWrap}>
              <Ionicons name="warning" size={20} color="#B45309" />
            </View>
            <View style={styles.alertTextWrap}>
              <Text style={styles.alertTitle}>Certificado digital necessário</Text>
              <Text style={styles.alertDesc}>Faça upload para assinar documentos</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ATENDIMENTOS PENDENTES</Text>
          <Pressable
            onPress={() => router.push('/(doctor)/requests')}
            style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.seeAllText}>Ver tudo</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        </View>

        {loading ? (
          <SkeletonList count={3} />
        ) : pendingList.length > 0 ? (
          pendingList.map((req) => {
            const { label: statusLabel, colorKey } = getRequestUiState(req);
            const { color: statusColor, bg: statusBg } = UI_STATUS_COLORS[colorKey];
            const typeLabel = TYPE_LABELS[req.requestType] ?? 'Solicitação';
            const summary = getShortSummary(req);
            const actionLabel = getActionButtonLabel(req);
            return (
              <DoctorCard key={req.id} style={styles.pendingCardWrap}>
                <View style={styles.pendingCardRow}>
                  <Pressable
                    style={({ pressed }) => [styles.pendingCardMain, pressed && styles.pendingCardPressed]}
                    onPress={() => router.push(`/doctor-request/${req.id}`)}
                  >
                    <Text style={styles.pendingCardType}>{typeLabel}</Text>
                    <Text style={styles.pendingCardPatient} numberOfLines={1}>
                      {req.patientName || 'Paciente'}
                    </Text>
                    {summary !== '—' && (
                      <Text style={styles.pendingCardSummary} numberOfLines={1}>
                        {summary}
                      </Text>
                    )}
                    <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                      <Text style={[styles.statusPillText, { color: statusColor }]} numberOfLines={1}>
                        {statusLabel}
                      </Text>
                    </View>
                  </Pressable>
                  <PrimaryButton
                    label={actionLabel}
                    showArrow
                    onPress={() => router.push(`/doctor-request/${req.id}`)}
                    style={styles.entryBtn}
                  />
                </View>
              </DoctorCard>
            );
          })
        ) : (
          <EmptyState
            icon="medical-outline"
            emoji="🏥"
            title="Nenhum atendimento pendente"
            subtitle="Quando houver pedidos que exijam sua ação, eles aparecerão aqui."
            actionLabel="Ver todos os pedidos"
            onAction={() => router.push('/(doctor)/requests')}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 110,
  },
  header: {
    paddingHorizontal: pad,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTextWrap: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  pendingSummary: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    minHeight: 100,
  },
  body: {
    paddingHorizontal: pad,
    paddingTop: doctorDS.sectionGap,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTextWrap: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  alertDesc: { fontSize: 12, color: '#B45309', marginTop: 1 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  pendingCardWrap: {
    marginBottom: spacing.md,
  },
  pendingCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingCardMain: {
    flex: 1,
    minWidth: 0,
  },
  pendingCardPressed: {
    opacity: 0.92,
  },
  pendingCardType: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  pendingCardPatient: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  pendingCardSummary: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 6,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  entryBtn: {
    minWidth: 72,
    paddingHorizontal: 16,
  },
});
