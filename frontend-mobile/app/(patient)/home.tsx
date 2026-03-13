import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { layout as dsLayout, shadows as dsShadows, borderRadius as dsBorderRadius } from '../../lib/designSystem';
import { DASHBOARD_STATS_LABELS } from '../../lib/domain/statusLabels';
import { RequestResponseDto } from '../../types/database';
import { useRequestsQuery } from '../../lib/hooks/useRequestsQuery';
import { getRequestUiState, needsPayment, isSignedOrDelivered } from '../../lib/domain/getRequestUiState';
import RequestCard from '../../components/RequestCard';
import { StatsCard } from '../../components/StatsCard';
import { LargeActionCard } from '../../components/ui/LargeActionCard';
import { InfoCard } from '../../components/ui/InfoCard';
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
import { getGreeting } from '../../lib/utils/format';

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

  const derived = useMemo(() => {
    let pending = 0, toPay = 0, ready = 0;
    let prescriptionCount = 0, examCount = 0;
    let lastConsultation: RequestResponseDto | null = null;
    let lastSignedPrescription: RequestResponseDto | null = null;
    let lastSignedExam: RequestResponseDto | null = null;
    const medsSet = new Set<string>();

    const priorityMap: Record<string, number> = {
      approved_pending_payment: 100, pending_payment: 100, paid: 95,
      signed: 90, in_review: 80, submitted: 70, searching_doctor: 65, in_consultation: 50,
    };
    const terminalStatuses = ['delivered', 'consultation_finished', 'rejected', 'cancelled'];
    let followUpRequest: RequestResponseDto | null = null;
    let followUpPriority = -1;

    for (const r of requests) {
      const ui = getRequestUiState(r);
      if (ui.uiState === 'needs_action') pending++;
      if (needsPayment(r)) toPay++;
      if (isSignedOrDelivered(r)) ready++;

      if (r.requestType === 'prescription') {
        prescriptionCount++;
        r.medications?.forEach(m => m && medsSet.add(m));
        if (isSignedOrDelivered(r)) {
          const d = new Date(r.signedAt ?? r.updatedAt).getTime();
          if (!lastSignedPrescription || d > new Date(lastSignedPrescription.signedAt ?? lastSignedPrescription.updatedAt).getTime()) {
            lastSignedPrescription = r;
          }
        }
      }
      if (r.requestType === 'exam') {
        examCount++;
        if (isSignedOrDelivered(r)) {
          const d = new Date(r.signedAt ?? r.updatedAt).getTime();
          if (!lastSignedExam || d > new Date(lastSignedExam.signedAt ?? lastSignedExam.updatedAt).getTime()) {
            lastSignedExam = r;
          }
        }
      }
      if (r.requestType === 'consultation') {
        if (!lastConsultation || new Date(r.createdAt).getTime() > new Date(lastConsultation.createdAt).getTime()) {
          lastConsultation = r;
        }
      }

      if (!terminalStatuses.includes(r.status)) {
        const p = priorityMap[r.status] ?? 0;
        if (p > followUpPriority) {
          followUpPriority = p;
          followUpRequest = r;
        }
      }
    }

    const msDay = 24 * 60 * 60 * 1000;
    const daysAgo = (r: RequestResponseDto | null) => {
      if (!r) return undefined;
      const ref = r.signedAt ?? r.updatedAt ?? r.createdAt;
      return Math.floor((Date.now() - new Date(ref).getTime()) / msDay);
    };

    const recentRequests = followUpRequest
      ? requests.filter(r => r.id !== followUpRequest!.id).slice(0, 2)
      : requests.slice(0, 2);

    return {
      stats: { pending, toPay, ready },
      recentPrescriptionCount: prescriptionCount,
      recentExamCount: examCount,
      lastConsultation,
      lastConsultationDays: lastConsultation
        ? Math.floor((Date.now() - new Date(lastConsultation.createdAt).getTime()) / msDay)
        : undefined,
      lastPrescriptionDaysAgo: daysAgo(lastSignedPrescription),
      lastExamDaysAgo: daysAgo(lastSignedExam),
      recentMedications: [...medsSet].slice(0, 10),
      followUpRequest,
      recentRequests,
    };
  }, [requests]);

  const {
    stats, recentPrescriptionCount, recentExamCount,
    lastConsultationDays, lastPrescriptionDaysAgo, lastExamDaysAgo,
    recentMedications, followUpRequest, recentRequests,
  } = derived;

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

  const firstName = user?.name?.split(' ')[0] || 'Paciente';
  const initial = firstName[0]?.toUpperCase() || 'P';

  const [followUpActionFromApi, setFollowUpActionFromApi] = useState<AssistantNextActionResponseData | null>(null);

  useEffect(() => {
    if (!followUpRequest?.id) {
      setFollowUpActionFromApi(null);
      return;
    }
    let cancelled = false;
    const currentFollowUp = followUpRequest; // capture stable ref for .catch
    getAssistantNextAction({ requestId: currentFollowUp.id })
      .then((res) => { if (!cancelled) setFollowUpActionFromApi(res); })
      .catch(() => {
        if (!cancelled && currentFollowUp) {
          const local = getNextBestActionForRequest(currentFollowUp);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- followUpRequest object ref is unstable; id+status are sufficient
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
      {/* ─── HEADER REDESIGN: mais limpo, saudação por horário ─── */}
      <LinearGradient
        colors={gradients.patientHeader as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerGreeting}>
            <Text style={styles.headerGreetingLabel}>{getGreeting()},</Text>
            <Text style={styles.headerGreetingName} numberOfLines={1} ellipsizeMode="tail">{firstName}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
            onPress={() => router.push('/(patient)/profile')}
            onPressIn={haptics.selection}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            {user?.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={{ width: '100%', height: '100%', borderRadius: 16 }}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
          </Pressable>
        </View>
      </LinearGradient>

      {/* ─── STATS: 3 cards flutuantes ─── */}
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

      {/* ─── Follow-up Card (Dra. Renoveja) ─── */}
      {followUpRequest && followUpAction ? (
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.followUpCard, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
            onPress={() => { haptics.selection(); router.push(`/request-detail/${followUpRequest.id}`); }}
            accessibilityRole="button"
            accessibilityLabel={`${followUpAction.title}. ${followUpAction.whatToDo}. Toque para ver detalhes.`}
          >
            <View style={styles.followUpHeader}>
              <View style={styles.followUpIcon}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.followUpLabel}>Próximo passo</Text>
                <Text style={styles.followUpTitle}>{followUpAction.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} importantForAccessibility="no" />
            </View>
            <Text style={styles.followUpBody}>{followUpAction.whatToDo}</Text>
            {followUpAction.eta ? (
              <View style={styles.followUpEtaRow}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                <Text style={styles.followUpEta}>{followUpAction.eta}</Text>
              </View>
            ) : null}
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
          </Pressable>
        </View>
      ) : null}
      </FadeIn>

      {/* ─── InfoCard da triagem ─── */}
      <FadeIn visible={!loading} {...motionTokens.fade.patientSection} delay={100} fill={false}>
      {showInfoCard && (
        <View style={styles.aiBannerWrap}>
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
        </View>
      )}
      </FadeIn>

      {/* ─── Quick Actions ─── */}
      <FadeIn visible={!loading} {...motionTokens.fade.patientSectionLong} delay={140} fill={false}>
      <View style={styles.actionsSection}>
        <Text style={styles.sectionLabel}>O QUE VOCÊ PRECISA?</Text>
        <View style={styles.actionsColumn}>
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="document-text" size={22} color={colors.primary} />
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
                <Ionicons name="flask" size={22} color={colors.info} />
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
              <View style={[styles.actionIconBox, { backgroundColor: colors.successLight }]}>
                <Ionicons name="videocam" size={22} color={colors.success} />
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

      {/* ─── Record Card v2 ─── */}
      <FadeIn visible={!loading} {...motionTokens.fade.patientSection} delay={200} fill={false}>
      <View style={styles.section}>
        <Pressable
          style={({ pressed }) => [styles.recordCard, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}
          onPress={() => {
            haptics.selection();
            router.push('/(patient)/record');
          }}
          accessibilityRole="button"
          accessibilityLabel="Abrir meu prontuário médico"
        >
          <View style={styles.recordIconWrap}>
            <Ionicons name="folder-open" size={22} color={colors.primary} />
          </View>
          <View style={styles.recordTextWrap}>
            <Text style={styles.recordTitle}>Meu Prontuário</Text>
            <Text style={styles.recordSubtitle}>Histórico de atendimentos, receitas e exames</Text>
          </View>
          <View style={styles.recordChevron}>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </View>
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

          <View style={{ height: dsLayout.cardGap * 3 }} />
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
    paddingHorizontal: dsLayout.screenPaddingHorizontal,
    paddingTop: 80,
    backgroundColor: colors.background,
  },

  // ─── Header v2: mais compacto e limpo ───
  header: {
    paddingHorizontal: dsLayout.screenPaddingHorizontal,
    paddingBottom: 56,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: { flex: 1 },
  headerGreetingLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontWeight: '500',
    color: colors.headerOverlayTextMuted,
    marginBottom: 2,
  },
  headerGreetingName: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '800',
    color: colors.headerOverlayText,
    letterSpacing: -0.3,
  },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.headerOverlaySurface,
    borderWidth: 2,
    overflow: 'hidden',
    borderColor: colors.headerOverlayBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: colors.headerOverlayText,
  },

  // ─── Stats v2 ───
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: -48,
    marginBottom: 8,
    paddingHorizontal: dsLayout.screenPaddingHorizontal,
    zIndex: 10,
    position: 'relative',
  },

  // ─── AI Banner ───
  aiBannerWrap: {
    paddingHorizontal: dsLayout.screenPaddingHorizontal,
    marginTop: 28,
  },

  // ─── Sections ───
  section: {
    marginTop: 28,
    paddingHorizontal: dsLayout.screenPaddingHorizontal,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.1,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
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

  // ─── Actions v2 ───
  actionsSection: {
    marginTop: 32,
    paddingHorizontal: dsLayout.screenPaddingHorizontal,
  },
  actionsColumn: {
    flexDirection: 'column',
    gap: 12,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Record Card v2 ───
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: dsBorderRadius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...dsShadows.card,
  },
  recordIconWrap: {
    width: 44,
    height: 44,
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
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.text,
  },
  recordSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  recordChevron: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // ─── Follow-up Card v2: mais limpo ───
  followUpCard: {
    backgroundColor: colors.surface,
    borderRadius: dsBorderRadius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + '20',
    ...dsShadows.card,
  },
  followUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  followUpIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUpLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  followUpTitle: {
    marginTop: 1,
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
  followUpEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  followUpEta: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
  },
  followUpPayCta: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 46,
  },
  followUpPayCtaText: {
    color: colors.headerOverlayText,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
  },
  });
}
