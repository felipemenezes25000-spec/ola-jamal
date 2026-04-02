import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
  useWindowDimensions,
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
import { getRequestUiState, isSignedOrDelivered } from '../../lib/domain/getRequestUiState';
import RequestCard from '../../components/RequestCard';
import { StatsCard } from '../../components/StatsCard';
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
import { ExpiringDocsBanner } from '../../components/post-consultation/ExpiringDocsBanner';
import type { AssistantNextActionResponseData } from '../../lib/api';
import { motionTokens } from '../../lib/ui/motion';
import { getGreeting, formatDateBR } from '../../lib/utils/format';
import { LargeActionCard } from '../../components/ui/LargeActionCard';

export default function PatientHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { user } = useAuth();
  const { data: requests = [], isLoading: loading, refetch } = useRequestsQuery();
  const { colors, gradients } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isCompact = screenWidth < 375;
  const styles = useMemo(() => makeStyles(colors, screenWidth), [colors, screenWidth]);

  const [refreshing, setRefreshing] = useState(false);
  const [showInfoCard, setShowInfoCard] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

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
    let pending = 0, ready = 0, total = 0, active = 0, completed = 0;
    let prescriptionCount = 0, examCount = 0;
    let lastConsultation: RequestResponseDto | null = null;
    let lastSignedPrescription: RequestResponseDto | null = null;
    let lastSignedExam: RequestResponseDto | null = null;
    const medsSet = new Set<string>();

    const priorityMap: Record<string, number> = {
      approved: 100,
      signed: 90, in_review: 80, submitted: 70, searching_doctor: 65, in_consultation: 50,
    };
    const terminalStatuses = ['delivered', 'consultation_finished', 'rejected', 'cancelled'];
    let followUpRequest: RequestResponseDto | null = null;
    let followUpPriority = -1;

    for (const r of requests) {
      total++;
      const ui = getRequestUiState(r);
      if (ui.uiState === 'needs_action') pending++;
      if (isSignedOrDelivered(r)) ready++;

      if (terminalStatuses.includes(r.status)) {
        completed++;
      } else {
        active++;
      }

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
      stats: { pending, ready, total, active, completed },
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
  const todayFormatted = useMemo(() => formatDateBR(new Date()), []);

  const [followUpActionFromApi, setFollowUpActionFromApi] = useState<AssistantNextActionResponseData | null>(null);

  // PERF: cache em memoria das respostas do assistente para evitar re-fetch em toda
  // navegacao quando o mesmo pedido ainda esta em andamento.
  // Chave: requestId:status -- invalida automaticamente quando o status muda.
  const assistantCacheRef = React.useRef<Map<string, AssistantNextActionResponseData>>(new Map());

  useEffect(() => {
    if (!followUpRequest?.id) {
      setFollowUpActionFromApi(null);
      return;
    }
    const cacheKey = `${followUpRequest.id}:${followUpRequest.status}`;
    const cached = assistantCacheRef.current.get(cacheKey);
    if (cached) {
      setFollowUpActionFromApi(cached);
      return;
    }

    let cancelled = false;
    const currentFollowUp = followUpRequest; // capture stable ref for .catch
    getAssistantNextAction({ requestId: currentFollowUp.id })
      .then((res) => {
        if (!cancelled) {
          // Guarda no cache (maximo 20 entradas para nao vazar memoria)
          if (assistantCacheRef.current.size >= 20) {
            const firstKey = assistantCacheRef.current.keys().next().value;
            if (firstKey) assistantCacheRef.current.delete(firstKey);
          }
          assistantCacheRef.current.set(cacheKey, res);
          setFollowUpActionFromApi(res);
        }
      })
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

  // Hero card message
  const heroMessage = useMemo(() => {
    if (stats.active > 0) {
      return `Você tem ${stats.active} pedido${stats.active > 1 ? 's' : ''} em andamento`;
    }
    return 'Seu histórico de saúde está aqui. Crie um novo pedido quando precisar.';
  }, [stats.active]);

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

      {/* ================================================================
          HEADER: Greeting + Date + Avatar
         ================================================================ */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerDate}>{todayFormatted}</Text>
            <Text
              style={[styles.headerGreeting, isCompact && { fontSize: 22 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {getGreeting()}, {firstName}!
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
            onPress={() => router.push('/(patient)/profile')}
            onPressIn={haptics.selection}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            {user?.avatarUrl && !avatarError ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={{ width: '100%', height: '100%', borderRadius: 24 }}
                resizeMode="cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* ================================================================
          HERO CARD: Gradient status + CTA
         ================================================================ */}
      <View style={styles.heroSection}>
        <LinearGradient
          colors={gradients.patientHeader as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIconRow}>
              <View style={styles.heroIconContainer}>
                <Ionicons name="heart-circle" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.heroStatusLabel}>SUA SAUDE</Text>
            </View>
            <Text style={styles.heroMessage}>{heroMessage}</Text>
            <Pressable
              style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              onPress={() => {
                haptics.light();
                router.push('/new-request/prescription');
              }}
              accessibilityRole="button"
              accessibilityLabel="Criar novo pedido"
            >
              <Ionicons name="add-circle" size={18} color={colors.primary} />
              <Text style={styles.heroCtaText}>Novo pedido</Text>
            </Pressable>
          </View>
          {/* Decorative circle */}
          <View style={styles.heroDecorCircle} />
          <View style={styles.heroDecorCircle2} />
        </LinearGradient>
      </View>

      {/* ================================================================
          STATS ROW: Total / Active / Completed
         ================================================================ */}
      <View style={styles.statsRow}>
        <StatsCard
          icon="documents"
          label={DASHBOARD_STATS_LABELS.analyzing}
          value={stats.total}
          iconColor={colors.primary}
          iconBgColor={colors.primarySoft}
          onPress={() => router.push('/(patient)/requests')}
        />
        <StatsCard
          icon="time"
          label="Ativos"
          value={stats.active}
          iconColor={colors.warning}
          iconBgColor={colors.warningLight}
          onPress={() => router.push('/(patient)/requests')}
        />
        <StatsCard
          icon="shield-checkmark"
          label={DASHBOARD_STATS_LABELS.ready}
          value={stats.completed}
          iconColor={colors.success}
          iconBgColor={colors.successLight}
          onPress={() => router.push('/(patient)/requests')}
        />
      </View>

      {/* ================================================================
          FOLLOW-UP CARD (Dra. Renoveja)
         ================================================================ */}
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
                <Text style={styles.followUpLabel}>PROXIMO PASSO</Text>
                <Text style={styles.followUpTitle}>{followUpAction.title}</Text>
              </View>
              <View style={styles.followUpChevron}>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.followUpBody}>{followUpAction.whatToDo}</Text>
            {followUpAction.eta ? (
              <View style={styles.followUpEtaRow}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                <Text style={styles.followUpEta}>{followUpAction.eta}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      ) : null}

      {/* ================================================================
          ACTIVE REQUESTS: Horizontal scroll
         ================================================================ */}
      {recentRequests.length > 0 ? (
        <View style={styles.sectionNoPad}>
          <View style={[styles.sectionHeader, { paddingHorizontal: dsLayout.screenPaddingHorizontal }]}>
            <Text style={styles.sectionLabel}>PEDIDOS RECENTES</Text>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalRequestsContent}
          >
            {recentRequests.map((req) => (
              <View key={req.id} style={styles.horizontalRequestCard}>
                <RequestCard
                  request={req}
                  onPress={() => {
                    haptics.selection();
                    router.push(`/request-detail/${req.id}`);
                  }}
                  suppressHorizontalMargin
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PEDIDOS RECENTES</Text>
          <AppEmptyState
            icon="document-text-outline"
            title="Nenhum pedido ainda"
            subtitle="Crie sua primeira solicitação usando as opções abaixo"
          />
        </View>
      )}

      {/* ================================================================
          QUICK ACTIONS: Premium vertical cards
         ================================================================ */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>O QUE VOCÊ PRECISA?</Text>
        <View style={styles.actionsColumn}>
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="document-text" size={26} color="#0284C7" />
              </View>
            }
            title="Renovar receita"
            description="Solicitar renovação de receita médica"
            variant="primary"
            chips={[
              { label: 'Mais usado', bg: '#E0F2FE', color: '#0369A1' },
              { label: 'Resposta em 24h', bg: '#F0FDF4', color: '#166534' },
            ]}
            onPress={() => { haptics.light(); router.push('/new-request/prescription'); }}
            accessibilityLabel="Solicitar renovação de receita médica. Mais usado. Resposta em 24 horas."
          />
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="flask" size={26} color="#2563EB" />
              </View>
            }
            title="Pedir exame"
            description="Solicitar exames e laudos médicos"
            variant="exam"
            chips={[
              { label: 'Hemograma, TSH, glicemia...', bg: '#DBEAFE', color: '#1E40AF' },
            ]}
            onPress={() => { haptics.light(); router.push('/new-request/exam'); }}
            accessibilityLabel="Solicitar pedido de exame. Hemograma, TSH, glicemia e outros."
          />
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="videocam" size={26} color="#059669" />
              </View>
            }
            title="Teleconsulta +"
            description="Atendimento por vídeo com profissional de saúde"
            variant="consultation"
            chips={[
              { label: 'Médicos disponíveis agora', bg: '#D1FAE5', color: '#065F46', showDot: true },
            ]}
            onPress={() => { haptics.light(); router.push('/new-request/consultation'); }}
            accessibilityLabel="Agendar consulta por vídeo. Médicos disponíveis agora."
          />
        </View>
      </View>

      {/* ================================================================
          SUS INFO BANNER
         ================================================================ */}
      <View style={styles.section}>
        <View
          style={styles.susBanner}
          accessible
          accessibilityLabel="Atendimento 100% gratuito via SUS. Todos os serviços são cobertos pelo Sistema Único de Saúde"
        >
          <View style={styles.susBannerIcon}>
            <Ionicons name="shield-checkmark" size={18} color={colors.success} importantForAccessibility="no" />
          </View>
          <View style={styles.susBannerText}>
            <Text style={styles.susBannerTitle} importantForAccessibility="no">Atendimento 100% gratuito via SUS</Text>
            <Text style={styles.susBannerSubtitle} importantForAccessibility="no">Todos os serviços são cobertos pelo Sistema Único de Saúde</Text>
          </View>
        </View>
      </View>

      {/* ================================================================
          AI TRIAGE INFO CARD
         ================================================================ */}
      {showInfoCard && (
        <View style={styles.section}>
          <View style={styles.triageCard}>
            <View style={styles.triageHeader}>
              <View style={styles.triageIconWrap}>
                <Ionicons name="sparkles" size={18} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.triageBadge}>TECNOLOGIA RENOVEJA+</Text>
                <Text style={styles.triageTitle}>Triagem feita com IA</Text>
              </View>
              <Pressable
                onPress={async () => {
                  await dismissHomeInfoCard();
                  setShowInfoCard(false);
                }}
                style={({ pressed }) => [styles.triageDismiss, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Dispensar"
                hitSlop={12}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.triageDescription}>
              Leitura inteligente de receitas e exames para agilizar seu atendimento.
            </Text>
          </View>
        </View>
      )}

      {/* ================================================================
          RECORD CARD
         ================================================================ */}
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

      {/* ================================================================
          EXPIRING DOCS BANNER
         ================================================================ */}
      {requests.length > 0 && <ExpiringDocsBanner requests={requests} />}

      <View style={{ height: dsLayout.cardGap * 3 }} />
        </ScrollView>
        </FadeIn>
      )}
    </View>
  );
}

function makeStyles(colors: DesignColors, screenWidth: number) {
  const isCompact = screenWidth < 375;
  const isTablet = screenWidth >= 768;
  const hPad = dsLayout.screenPaddingHorizontal;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F8FAFC',
    },
    content: {},
    loadingContainer: {
      flex: 1,
      paddingHorizontal: hPad,
      paddingTop: 80,
      backgroundColor: '#F8FAFC',
    },

    // ================================================================
    // HEADER
    // ================================================================
    header: {
      paddingHorizontal: hPad,
      paddingBottom: 20,
      backgroundColor: '#F8FAFC',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flex: 1,
      marginRight: 16,
    },
    headerDate: {
      fontSize: 13,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 4,
    },
    headerGreeting: {
      fontSize: isCompact ? 22 : 26,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    avatarBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primarySoft,
      borderWidth: 2,
      overflow: 'hidden',
      borderColor: colors.primary + '30',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 18,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: colors.primary,
    },

    // ================================================================
    // HERO CARD
    // ================================================================
    heroSection: {
      paddingHorizontal: hPad,
      marginBottom: 20,
    },
    heroCard: {
      borderRadius: 20,
      padding: 20,
      overflow: 'hidden',
      minHeight: 150,
      justifyContent: 'center',
    },
    heroContent: {
      zIndex: 1,
    },
    heroIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    heroIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStatusLabel: {
      fontSize: 11,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 1.0,
      textTransform: 'uppercase',
    },
    heroMessage: {
      fontSize: 16,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontWeight: '500',
      color: '#FFFFFF',
      lineHeight: 22,
      marginBottom: 16,
      maxWidth: '85%',
    },
    heroCta: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
      ...dsShadows.sm,
    },
    heroCtaText: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: colors.primary,
    },
    heroDecorCircle: {
      position: 'absolute',
      right: -30,
      top: -30,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroDecorCircle2: {
      position: 'absolute',
      right: 40,
      bottom: -40,
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },

    // ================================================================
    // STATS ROW
    // ================================================================
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 8,
      paddingHorizontal: hPad,
    },

    // ================================================================
    // FOLLOW-UP CARD
    // ================================================================
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
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    followUpLabel: {
      fontSize: 11,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    followUpTitle: {
      marginTop: 2,
      fontSize: 15,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: colors.text,
    },
    followUpChevron: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    followUpBody: {
      marginTop: 12,
      fontSize: 13,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textSecondary,
      lineHeight: 19,
    },
    followUpEtaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    followUpEta: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_500Medium',
      color: colors.textMuted,
    },

    // ================================================================
    // SECTIONS
    // ================================================================
    section: {
      marginTop: 24,
      paddingHorizontal: hPad,
    },
    sectionNoPad: {
      marginTop: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1.0,
      marginBottom: 12,
    },
    seeAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    seeAllText: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.primary,
    },

    // ================================================================
    // HORIZONTAL REQUESTS
    // ================================================================
    horizontalRequestsContent: {
      paddingHorizontal: hPad,
      gap: 12,
    },
    horizontalRequestCard: {
      width: isTablet ? 340 : Math.min(screenWidth * 0.78, 300),
    },

    // ================================================================
    // QUICK ACTIONS: Premium vertical cards
    // ================================================================
    actionsColumn: {
      flexDirection: 'column',
      gap: 10,
    },
    actionIconBox: {
      width: 56,
      height: 56,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ================================================================
    // SUS BANNER
    // ================================================================
    susBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F0FDF4',
      borderRadius: dsBorderRadius.card,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: '#DCFCE7',
    },
    susBannerIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    susBannerText: {
      flex: 1,
    },
    susBannerTitle: {
      fontSize: 13,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: '#15803D',
    },
    susBannerSubtitle: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: '#16A34A',
      marginTop: 2,
      lineHeight: 16,
    },

    // ================================================================
    // AI TRIAGE CARD (purple accent)
    // ================================================================
    triageCard: {
      backgroundColor: colors.surface,
      borderRadius: dsBorderRadius.card,
      padding: 16,
      borderWidth: 1,
      borderColor: '#8B5CF620',
      ...dsShadows.card,
    },
    triageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    triageIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: '#EDE9FE',
      alignItems: 'center',
      justifyContent: 'center',
    },
    triageBadge: {
      fontSize: 10,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: '#8B5CF6',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    triageTitle: {
      fontSize: 15,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
    },
    triageDismiss: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    triageDescription: {
      fontSize: 13,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textSecondary,
      lineHeight: 19,
    },

    // ================================================================
    // RECORD CARD
    // ================================================================
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
  });
}
