import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { uiTokens } from '../../lib/ui/tokens';
import { STATUS_LABELS_PT, DASHBOARD_STATS_LABELS } from '../../lib/domain/statusLabels';
import { RequestResponseDto } from '../../types/database';
import { useRequestsQuery } from '../../lib/hooks/useRequestsQuery';
import { getRequestUiState, needsPayment, isSignedOrDelivered } from '../../lib/domain/getRequestUiState';
import RequestCard from '../../components/RequestCard';
import { StatsCard } from '../../components/StatsCard';
import { LargeActionCard } from '../../components/ui/LargeActionCard';
import { InfoCard } from '../../components/ui/InfoCard';
import { HeaderInfo } from '../../components/ui/HeaderInfo';
import { AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { useTriageEval } from '../../hooks/useTriageEval';
import {
  shouldShowHomeInfoCard,
  incrementHomeVisit,
  dismissHomeInfoCard,
} from '../../lib/triage/triagePersistence';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';
import { getNextBestActionForRequest } from '../../lib/domain/assistantIntelligence';
import { getAssistantNextAction } from '../../lib/api';
import type { AssistantNextActionResponseData } from '../../lib/api';
import { motionTokens } from '../../lib/ui/motion';

export default function PatientHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { user } = useAuth();
  const { data: requests = [], isLoading: loading, refetch } = useRequestsQuery();
  const { colors, gradients } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [refreshing, setRefreshing] = useState(false);
  const [showInfoCard, setShowInfoCard] = useState(true);

  useFocusEffect(
    useCallback(() => {
      incrementHomeVisit();
      shouldShowHomeInfoCard().then(setShowInfoCard);
    }, [])
  );

  const onRefresh = useCallback(async () => {
    haptics.light();
    setRefreshing(true);
    try {
      await refetch();
      showToast({ message: 'Início atualizado', type: 'success' });
    } catch {
      showToast({ message: 'Não foi possível atualizar o início', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const stats = useMemo(() => ({
    pending: requests.filter(r => getRequestUiState(r).uiState === 'needs_action').length,
    toPay: requests.filter(r => needsPayment(r)).length,
    ready: requests.filter(r => isSignedOrDelivered(r)).length,
  }), [requests]);

  const firstName = user?.name?.split(' ')[0] || 'Paciente';
  const initial = firstName[0]?.toUpperCase() || 'P';

  const recentPrescriptionCount = useMemo(
    () => requests.filter((r) => r.requestType === 'prescription').length,
    [requests]
  );
  const recentExamCount = useMemo(
    () => requests.filter((r) => r.requestType === 'exam').length,
    [requests]
  );
  const lastConsultation = useMemo(() => {
    const cons = requests.filter((r) => r.requestType === 'consultation');
    if (cons.length === 0) return null;
    const sorted = [...cons].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sorted[0];
  }, [requests]);
  const lastConsultationDays = lastConsultation
    ? Math.floor(
        (Date.now() - new Date(lastConsultation.createdAt).getTime()) / (24 * 60 * 60 * 1000)
      )
    : undefined;

  // Última receita assinada (para sugestão de renovação)
  const lastPrescriptionDaysAgo = useMemo(() => {
    const signed = requests
      .filter((r) => r.requestType === 'prescription' && isSignedOrDelivered(r))
      .sort((a, b) => new Date(b.signedAt ?? b.updatedAt).getTime() - new Date(a.signedAt ?? a.updatedAt).getTime());
    if (signed.length === 0) return undefined;
    const last = signed[0];
    const refDate = last.signedAt ?? last.updatedAt ?? last.createdAt;
    return Math.floor((Date.now() - new Date(refDate).getTime()) / (24 * 60 * 60 * 1000));
  }, [requests]);

  // Último exame assinado
  const lastExamDaysAgo = useMemo(() => {
    const signed = requests
      .filter((r) => r.requestType === 'exam' && isSignedOrDelivered(r))
      .sort((a, b) => new Date(b.signedAt ?? b.updatedAt).getTime() - new Date(a.signedAt ?? a.updatedAt).getTime());
    if (signed.length === 0) return undefined;
    const last = signed[0];
    const refDate = last.signedAt ?? last.updatedAt ?? last.createdAt;
    return Math.floor((Date.now() - new Date(refDate).getTime()) / (24 * 60 * 60 * 1000));
  }, [requests]);

  // Idade do paciente (para recomendações por faixa etária)
  const patientAge = useMemo(() => {
    const bd = user?.birthDate;
    if (!bd) return undefined;
    const birth = new Date(bd);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : undefined;
  }, [user?.birthDate]);

  const recentMedications = useMemo(() => {
    const meds = requests
      .filter((r) => r.requestType === 'prescription' && r.medications?.length)
      .flatMap((r) => r.medications!)
      .filter(Boolean)
      .slice(0, 10);
    return [...new Set(meds)];
  }, [requests]);

  const followUpRequest = useMemo(() => {
    if (requests.length === 0) return null;
    const priorityMap: Record<string, number> = {
      approved_pending_payment: 100,
      pending_payment: 100,
      paid: 95,
      signed: 90,
      in_review: 80,
      submitted: 70,
      searching_doctor: 65,
      in_consultation: 50,
    };

    return [...requests]
      .filter((request) => !['delivered', 'consultation_finished', 'rejected', 'cancelled'].includes(request.status))
      .sort((a, b) => (priorityMap[b.status] ?? 0) - (priorityMap[a.status] ?? 0))[0] ?? null;
  }, [requests]);

  // Deduplica: não mostra na lista recente o pedido que já aparece no card de follow-up
  const recentRequests = useMemo(() => {
    const filtered = followUpRequest
      ? requests.filter(r => r.id !== followUpRequest.id)
      : requests;
    return filtered.slice(0, 2);
  }, [requests, followUpRequest]);

  const [followUpActionFromApi, setFollowUpActionFromApi] = useState<AssistantNextActionResponseData | null>(null);

  useEffect(() => {
    if (!followUpRequest?.id) {
      setFollowUpActionFromApi(null);
      return;
    }
    let cancelled = false;
    getAssistantNextAction({ requestId: followUpRequest.id })
      .then((res) => { if (!cancelled) setFollowUpActionFromApi(res); })
      .catch(() => {
        if (!cancelled && followUpRequest) {
          const local = getNextBestActionForRequest(followUpRequest);
          setFollowUpActionFromApi({
            title: local.title,
            statusSummary: local.statusSummary,
            whatToDo: local.whatToDo,
            eta: local.eta,
            ctaLabel: local.ctaLabel ?? null,
            intent: local.intent,
          });
        }
      });
    return () => { cancelled = true; };
  }, [followUpRequest?.id, followUpRequest?.status]);

  const followUpAction = useMemo(() => {
    if (followUpActionFromApi) return followUpActionFromApi;
    if (!followUpRequest) return null;
    const local = getNextBestActionForRequest(followUpRequest);
    return { ...local, ctaLabel: local.ctaLabel ?? null };
  }, [followUpActionFromApi, followUpRequest]);

  useTriageEval({
    context: 'home',
    step: 'idle',
    role: 'patient',
    totalRequests: requests.length,
    recentPrescriptionCount,
    recentExamCount,
    lastConsultationDays,
    lastPrescriptionDaysAgo,
    lastExamDaysAgo,
    patientAge,
    recentMedications: recentMedications.length ? recentMedications : undefined,
    requestId: followUpRequest?.id,
    status: followUpRequest?.status,
    requestType: followUpRequest?.requestType as any,
  });

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <SkeletonList count={4} />
        </View>
      ) : (
        <FadeIn visible={!loading} {...motionTokens.fade.patient}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: listPadding }]}
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
      {/* Header: só saudação + avatar (igual ao web) */}
      <LinearGradient
        colors={gradients.patientHeader as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerGreeting}>
            <Text style={styles.headerGreetingLabel}>Olá,</Text>
            <Text style={styles.headerGreetingName} numberOfLines={1} ellipsizeMode="tail">{firstName}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/(patient)/profile')}
            onPressIn={haptics.selection}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Stats: três cards brancos flutuando sobre o fundo cinza */}
      <FadeIn visible={!loading} {...motionTokens.fade.patientSection} delay={50} fill={false}>
      <View style={styles.statsRow}>
        <StatsCard
          icon="analytics"
          label={DASHBOARD_STATS_LABELS.analyzing}
          value={stats.pending}
          iconColor={colors.warning}
          iconBgColor={colors.warningLight}
          onPress={() => router.push('/(patient)/requests')}
        />
        <StatsCard
          icon="wallet"
          label={DASHBOARD_STATS_LABELS.toPay}
          value={stats.toPay}
          iconColor={colors.error}
          iconBgColor={colors.errorLight}
          onPress={() => router.push('/(patient)/requests')}
        />
        <StatsCard
          icon="shield-checkmark"
          label={DASHBOARD_STATS_LABELS.ready}
          value={stats.ready}
          iconColor={colors.success}
          iconBgColor={colors.successLight}
          onPress={() => router.push('/(patient)/requests')}
        />
      </View>

      {followUpRequest && followUpAction ? (
        <View style={styles.section}>
          <View style={styles.followUpCard}>
            <Pressable
              onPress={() => { haptics.selection(); router.push(`/request-detail/${followUpRequest.id}`); }}
              accessibilityRole="button"
              accessibilityLabel={`${followUpAction.title}. ${followUpAction.whatToDo}. Toque para ver detalhes.`}
            >
              <View style={styles.followUpHeader}>
                <View style={styles.followUpIcon}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.followUpTitle}>Dra. Renoveja: seu próximo passo</Text>
                  <Text style={styles.followUpSubtitle}>{followUpAction.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} importantForAccessibility="no" />
              </View>
              <Text style={styles.followUpBody}>{followUpAction.whatToDo}</Text>
              <Text style={styles.followUpEta}>{followUpAction.eta}</Text>
            </Pressable>
            {followUpAction.intent === 'pay' && needsPayment(followUpRequest) && (
              <Pressable
                style={({ pressed }) => [styles.followUpPayCta, pressed && { opacity: 0.85 }]}
                onPress={() => { haptics.selection(); router.push(`/payment/request/${followUpRequest.id}`); }}
                accessibilityRole="button"
                accessibilityLabel="Pagar agora"
              >
                <Ionicons name="card" size={15} color={colors.headerOverlayText} />
                <Text style={styles.followUpPayCtaText}>{followUpAction.ctaLabel ?? 'Pagar agora'}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.headerOverlayTextMuted} importantForAccessibility="no" />
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
      </FadeIn>

      {/* ─── InfoCard da triagem (explicação) ─── */}
      <FadeIn visible={!loading} {...motionTokens.fade.patientSection} delay={100} fill={false}>
      <View style={styles.aiBannerWrap}>
        {showInfoCard && (
          <InfoCard
            icon="sparkles-outline"
            title="Triagem feita com IA"
            description="Leitura inteligente de receitas e exames para agilizar seu atendimento."
            badge="Tecnologia RenoveJá+"
            onDismiss={async () => {
              await dismissHomeInfoCard();
              setShowInfoCard(false);
            }}
          />
        )}
      </View>
      </FadeIn>

      {/* ─── Quick Actions (largura total, menos margem) ─── */}
      <FadeIn visible={!loading} {...motionTokens.fade.patientSectionLong} delay={140} fill={false}>
      <View style={styles.actionsSection}>
        <HeaderInfo
          title="Falar com um profissional de saúde"
          subtitle="Acesse um profissional médico para:"
          accessibilityLabel="Falar com um profissional de saúde. Acesse um profissional médico para: renovar receitas, solicitar exames ou consulta por teleatendimento."
        />
        <View style={styles.actionsColumn}>
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="document-text" size={24} color={colors.primary} />
              </View>
            }
            title="Renovar Receita"
            description="Solicitar renovação de receita médica"
            variant="primary"
            onPress={() => router.push('/new-request/prescription')}
            accessibilityLabel="Solicitar renovação de receita médica"
          />
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: colors.infoLight }]}>
                <Ionicons name="flask" size={24} color={colors.info} />
              </View>
            }
            title="Pedir Exame"
            description="Solicitar exames e laudos"
            variant="exam"
            onPress={() => router.push('/new-request/exam')}
            accessibilityLabel="Solicitar pedido de exame"
          />
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="videocam" size={24} color={colors.accent} />
              </View>
            }
            title="Consulta Breve +"
            description="Atendimento por vídeo com o médico"
            variant="consultation"
            onPress={() => router.push('/new-request/consultation')}
            accessibilityLabel="Agendar consulta por vídeo"
          />
        </View>
      </View>
      </FadeIn>

      {/* ─── Prontuário ─── */}
      <FadeIn visible={!loading} {...motionTokens.fade.patientSection} delay={200} fill={false}>
      <View style={styles.section}>
        <Pressable
          style={({ pressed }) => [styles.recordCard, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          onPress={() => {
            haptics.selection();
            router.push('/(patient)/record');
          }}
          accessibilityRole="button"
          accessibilityLabel="Abrir meu prontuário médico"
        >
          <View style={styles.recordIconWrap}>
            <Ionicons name="folder-open" size={24} color={colors.primary} />
          </View>
          <View style={styles.recordTextWrap}>
            <Text style={styles.recordTitle}>Meu Prontuário</Text>
            <Text style={styles.recordSubtitle}>Veja seu histórico de atendimentos, receitas e exames</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      </FadeIn>

      {/* ─── Recent Requests ─── */}
      <FadeIn visible={!loading} {...motionTokens.fade.patientSectionLong} delay={240} fill={false}>
      {recentRequests.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pedidos recentes</Text>
            <Pressable
              onPress={() => {
                haptics.selection();
                router.push('/(patient)/requests');
              }}
              style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Ver todos os pedidos"
            >
              <Text style={styles.seeAllText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.sectionHint} numberOfLines={2} ellipsizeMode="tail">Toque em um pedido para ver os detalhes. Use "Ver todos" para ver a lista completa.</Text>
          {recentRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              onPress={() => {
                haptics.selection();
                router.push(`/request-detail/${req.id}`);
              }}
              suppressHorizontalMargin
            />
          ))}
        </View>
      ) : (
        <View style={styles.section}>
          <AppEmptyState
            icon="document-text-outline"
            title="Nenhum pedido ainda"
            subtitle="Crie sua primeira solicitação usando as opções acima"
          />
        </View>
      )}
      </FadeIn>
          {/* Espaço extra para não colar na tab bar */}
          <View style={{ height: uiTokens.cardGap * 3 }} />
        </ScrollView>
        </FadeIn>
      )}
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {},
  loadingContainer: {
    flex: 1,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingTop: 80,
    backgroundColor: colors.background,
  },
  // ─── Header ───
  header: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: 50,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: {
    flex: 1,
  },
  headerGreetingLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontWeight: '500',
    color: colors.headerOverlayTextMuted,
    marginBottom: 2,
  },
  headerGreetingName: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '800',
    color: colors.headerOverlayText,
    letterSpacing: -0.2,
  },
  avatarBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.headerOverlaySurface,
    borderWidth: 2,
    borderColor: colors.headerOverlayBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: colors.headerOverlayText,
  },

  // ─── Destaque IA ───
  aiBannerWrap: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    marginTop: 24,
  },

  // ─── Stats (flutuando sobre o cinza, igual ao web) ───
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -44,
    marginBottom: 0,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    zIndex: 10,
    position: 'relative',
  },

  // ─── Sections ───
  section: {
    marginTop: 24,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 20,
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

  // ─── Actions Section ───
  actionsSection: {
    marginTop: 24,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  actionsColumn: {
    flexDirection: 'column',
    gap: 16,
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Record Card (Prontuário) ───
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  recordIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordTextWrap: { flex: 1 },
  recordTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  recordSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  followUpCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + '26',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  followUpHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  followUpIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUpTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  followUpSubtitle: {
    marginTop: 2,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.text,
  },
  followUpBody: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.textSecondary,
    lineHeight: 19,
  },
  followUpEta: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
  },
  followUpPayCta: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  followUpPayCtaText: {
    color: colors.headerOverlayText,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
  },
  });
}
