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
import { useRequestsEvents } from '../../contexts/RequestsEventsContext';
import { colors, spacing, typography, gradients, doctorDS } from '../../lib/themeDoctor';
const pad = doctorDS.screenPaddingHorizontal;
import { getRequests, getActiveCertificate } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { cacheRequest } from '../doctor-request/[id]';
import { StatsCard } from '../../components/StatsCard';
import { AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
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
import { useTriageEval } from '../../hooks/useTriageEval';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';
import { motionTokens } from '../../lib/ui/motion';

const TYPE_LABELS: Record<string, string> = {
  prescription: 'Receita',
  exam: 'Exame',
  consultation: 'Consulta',
};

function getShortSummary(request: RequestResponseDto): string {
  if (request.requestType === 'prescription' && request.medications?.length) {
    const first = request.medications[0] ?? '';
    return request.medications.length > 1 ? `${first} +${request.medications.length - 1}` : String(first);
  }
  if (request.requestType === 'exam' && request.exams?.length) {
    const first = request.exams[0] ?? '';
    return request.exams.length > 1 ? `${first} +${request.exams.length - 1}` : String(first);
  }
  if (request.requestType === 'consultation' && request.symptoms) {
    return request.symptoms.length > 40 ? request.symptoms.slice(0, 40) + '…' : request.symptoms;
  }
  return '—';
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

  const loadData = useCallback(async (withFeedback = false) => {
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
      if (withFeedback) {
        showToast({ message: 'Painel atualizado', type: 'success' });
      }
    } catch (e) {
      console.error(e);
      if (withFeedback) {
        showToast({ message: 'Não foi possível atualizar o painel', type: 'error' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const { subscribe, isConnected } = useRequestsEvents();

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Polling fallback quando SignalR desconectado — evita médico precisar dar refresh
      if (!isConnected) {
        const interval = setInterval(loadData, 15000);
        return () => clearInterval(interval);
      }
    }, [loadData, isConnected])
  );

  useEffect(() => {
    return subscribe(() => {
      loadData();
    });
  }, [subscribe, loadData]);

  const onRefresh = () => {
    haptics.light();
    setRefreshing(true);
    loadData(true);
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

  // Dra. Renoveja — fluxo do médico (uso da plataforma)
  useTriageEval({
    context: 'doctor_dashboard',
    step: 'idle',
    role: 'doctor',
    doctorPendingCount: pendentesCount,
    doctorHasCertificate: hasCertificate === false ? false : hasCertificate === true ? true : undefined,
  });

  return (
    <View style={styles.container}>
      <FadeIn visible={!loading} {...motionTokens.fade.doctor}>
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

      <FadeIn visible={!loading} {...motionTokens.fade.doctorSection} delay={40} fill={false}>
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
      </FadeIn>

      <View style={styles.body}>
        {hasCertificate === false && (
          <FadeIn visible={!loading} {...motionTokens.fade.doctorSection} delay={85} fill={false}>
          <Pressable
            style={({ pressed }) => [styles.alertBanner, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/certificate/upload')}
            accessibilityRole="button"
            accessibilityLabel="Fazer upload do certificado digital"
          >
            <View style={styles.alertIconWrap}>
              <Ionicons name="warning" size={18} color="#B45309" />
            </View>
            <View style={styles.alertTextWrap}>
              <Text style={styles.alertTitle}>Certificado digital necessário</Text>
              <Text style={styles.alertDesc}>Faça upload para assinar documentos</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
          </FadeIn>
        )}

        <FadeIn visible={!loading} {...motionTokens.fade.doctorSection} delay={120} fill={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Atendimentos pendentes</Text>
          <Pressable
            onPress={() => router.push('/(doctor)/requests')}
            style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Ver todos os atendimentos"
          >
            <Text style={styles.seeAllText}>Ver tudo</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        </View>
        </FadeIn>

        {loading ? (
          <SkeletonList count={3} />
        ) : pendingList.length > 0 ? (
          pendingList.map((req, idx) => {
            const { label: statusLabel, colorKey } = getRequestUiState(req);
            const { color: statusColor, bg: statusBg } = UI_STATUS_COLORS[colorKey];
            const typeLabel = TYPE_LABELS[req.requestType] ?? 'Solicitação';
            const summary = getShortSummary(req);
            return (
              <FadeIn key={req.id} visible={!loading} {...motionTokens.fade.doctorItem} delay={145 + idx * 28} fill={false}>
              <DoctorCard style={styles.pendingCardWrap} onPress={() => { haptics.selection(); cacheRequest(req); router.push(`/doctor-request/${req.id}`); }} accessibilityLabel={`Atendimento de ${req.patientName || 'Paciente'}`}>
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
              </FadeIn>
            );
          })
        ) : (
          <FadeIn visible={!loading} {...motionTokens.fade.doctorItem} delay={145} fill={false}>
            <AppEmptyState
              icon="medical-outline"
              title="Nenhum atendimento pendente"
              subtitle="Quando houver pedidos que exijam sua ação, eles aparecerão aqui."
              actionLabel="Ver todos os pedidos"
              onAction={() => router.push('/(doctor)/requests')}
            />
          </FadeIn>
        )}
      </View>
      </ScrollView>
      </FadeIn>
    </View>
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
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -36,
    marginBottom: 4,
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
  alertTitle: { fontSize: 12, fontWeight: '700', color: '#92400E', letterSpacing: 0.2 },
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
    letterSpacing: 0.2,
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
    letterSpacing: 0.2,
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
    letterSpacing: 0.2,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
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
