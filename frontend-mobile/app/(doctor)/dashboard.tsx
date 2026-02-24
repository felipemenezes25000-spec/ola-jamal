import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography, gradients, doctorDS } from '../../lib/themeDoctor';
const pad = doctorDS.screenPaddingHorizontal;
import { getRequests, getActiveCertificate } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { cacheRequest } from '../doctor-request/[id]';
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
  const listPadding = useListBottomPadding();
  const { user } = useAuth();
  const [queue, setQueue] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCertificate, setHasCertificate] = useState<boolean | null>(null);
  const lastQueueHash = useRef('');

  const loadData = useCallback(async () => {
    try {
      const [cert, res] = await Promise.allSettled([
        getActiveCertificate(),
        getRequests({ page: 1, pageSize: 50 }),
      ]);
      setHasCertificate(cert.status === 'fulfilled' && !!cert.value);
      const items = res.status === 'fulfilled' ? (res.value?.items ?? (res.value as { Items?: unknown[] })?.Items ?? []) : [];
      // Evita re-render se os dados não mudaram (polling silencioso)
      const hash = items.map((r: RequestResponseDto) => `${r.id}:${r.status}:${r.updatedAt}`).join('|');
      if (hash !== lastQueueHash.current) {
        lastQueueHash.current = hash;
        setQueue(items);
      }
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

  const { pendentesCount, naFila, consultaPronta, emConsulta, pendingList } = useMemo(() => ({
    pendentesCount: countPendentes(queue),
    naFila: countNaFila(queue),
    consultaPronta: countConsultaPronta(queue),
    emConsulta: countEmConsulta(queue),
    pendingList: getPendingForPanel(queue, 10),
  }), [queue]);

  const firstName = user?.name?.split(' ')[0] || 'Médico';
  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: listPadding }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[...gradients.doctorHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.headerTextWrap}>
          <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{greeting}, Dr(a). {firstName}</Text>
          <Text style={styles.pendingSummary} numberOfLines={2} ellipsizeMode="tail">
            {pendentesCount} atendimento{pendentesCount !== 1 ? 's' : ''} pendente{pendentesCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.statsRow}>
        <StatsCard
          icon="time-outline"
          label="NA FILA"
          value={naFila}
          iconColor="#D97706"
          onPress={() => router.push('/(doctor)/requests')}
        />
        <StatsCard
          icon="videocam-outline"
          label="CONSULTA PRONTA"
          value={consultaPronta}
          iconColor={colors.primary}
          onPress={() => router.push('/(doctor)/requests')}
        />
        <StatsCard
          icon="checkmark-circle-outline"
          label="EM CONSULTA"
          value={emConsulta}
          iconColor="#059669"
          onPress={() => router.push('/(doctor)/requests')}
        />
      </View>

      <View style={styles.body}>
        {hasCertificate === false && (
          <Pressable
            style={({ pressed }) => [styles.alertBanner, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/certificate/upload')}
          >
            <View style={styles.alertIconWrap}>
              <Ionicons name="warning" size={18} color="#B45309" />
            </View>
            <View style={styles.alertTextWrap}>
              <Text style={styles.alertTitle}>CERTIFICADO DIGITAL NECESSÁRIO</Text>
              <Text style={styles.alertDesc}>Faça upload para assinar documentos</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ATENDIMENTOS PENDENTES</Text>
          <Pressable
            onPress={() => router.push('/(doctor)/requests')}
            style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.seeAllText}>VER TUDO</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        </View>

        {loading ? (
          <SkeletonList count={3} />
        ) : pendingList.length > 0 ? (
          pendingList.map((req) => {
            const { label: statusLabel, colorKey } = getRequestUiState(req);
            const { color: statusColor, bg: statusBg } = UI_STATUS_COLORS[colorKey];
            const typeLabel = (TYPE_LABELS[req.requestType] ?? 'Solicitação').toUpperCase();
            const summary = getShortSummary(req);
            const actionLabel = getActionButtonLabel(req);
            return (
              <DoctorCard key={req.id} style={styles.pendingCardWrap} onPress={() => { cacheRequest(req); router.push(`/doctor-request/${req.id}`); }}>
                <View style={styles.pendingCardRow}>
                  <View style={styles.pendingCardMain}>
                    <Text style={styles.pendingCardType}>{typeLabel}</Text>
                    <Text style={styles.pendingCardPatient} numberOfLines={1}>
                      {req.patientName || 'Paciente'}
                    </Text>
                    {summary !== '\u2014' && (
                      <Text style={styles.pendingCardSummary} numberOfLines={1}>
                        {summary}
                      </Text>
                    )}
                    <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                      <Text style={[styles.statusPillText, { color: statusColor }]} numberOfLines={1}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.entryArrow}>
                    <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                  </View>
                </View>
              </DoctorCard>
            );
          })
        ) : (
          <EmptyState
            icon="medical-outline"
            title="NENHUM ATENDIMENTO PENDENTE"
            subtitle="Quando houver pedidos que exijam sua ação, eles aparecerão aqui."
            actionLabel="VER TODOS OS PEDIDOS"
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
  content: {},
  header: {
    paddingHorizontal: pad,
    paddingBottom: 60,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTextWrap: {
    marginBottom: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  pendingSummary: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -40,
    marginBottom: 0,
    paddingHorizontal: pad,
    zIndex: 10,
    position: 'relative',
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTextWrap: { flex: 1 },
  alertTitle: { fontSize: 12, fontWeight: '700', color: '#92400E', letterSpacing: 0.4, textTransform: 'uppercase' },
  alertDesc: { fontSize: 12, color: '#B45309', marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  pendingCardWrap: {
    marginBottom: 12,
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
  pendingCardType: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
    letterSpacing: 0.8,
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
    marginBottom: 8,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  entryArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
