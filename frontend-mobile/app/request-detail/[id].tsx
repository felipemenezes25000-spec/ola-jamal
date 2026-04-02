import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { nav } from '../../lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { spacing, shadows } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { FadeIn } from '../../components/ui/FadeIn';
import { motionTokens } from '../../lib/ui/motion';
import type { DesignColors } from '../../lib/designSystem';
import { getDocumentDownloadUrl } from '../../lib/api';
import { useRequestDetailQuery, useCancelRequest, useMarkDelivered } from '../../lib/hooks/useRequestDetailQuery';
import { formatDateTimeBR } from '../../lib/utils/format';
import { StatusBadge } from '../../components/StatusBadge';
import StatusTracker from '../../components/StatusTracker';
import { AppButton, AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { ZoomableImage } from '../../components/ZoomableImage';
import { CompatibleImage } from '../../components/CompatibleImage';
import { FormattedAiSummary } from '../../components/FormattedAiSummary';
import { ObservationCard } from '../../components/triage';
import { useTriageEval } from '../../hooks/useTriageEval';
import { getNextBestActionForRequest, type NextActionIntent } from '../../lib/domain/assistantIntelligence';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useModalVisibility } from '../../contexts/ModalVisibilityContext';
import { ConsultationDocumentsCard } from '../../components/post-consultation/ConsultationDocumentsCard';
import { ConsultationConsentModal } from '../../components/consultation/ConsultationConsentModal';
import { DocumentValidityBadge } from '../../components/post-consultation/DocumentValidityBadge';
import { useAuth } from '../../contexts/AuthContext';

// ─── Constants ──────────────────────────────────────────────────
const HEADER_BG_RX = '#0C4A6E';
const HEADER_BG_CONSULT = '#8B5CF6';
const AI_ACCENT = '#8B5CF6';

// ─── Helper: Expandable text ────────────────────────────────────
function ExpandableText({ text, maxLines = 4, style }: { text: string; maxLines?: number; style?: any }) {
  const { colors } = useAppTheme();
  const isWeb = Platform.OS === 'web';
  const [expanded, setExpanded] = React.useState(isWeb);
  const [needsExpand, setNeedsExpand] = React.useState(false);
  return (
    <View>
      <Text
        style={style}
        numberOfLines={expanded ? undefined : maxLines}
        ellipsizeMode="tail"
        onTextLayout={isWeb ? undefined : (e) => {
          if (!needsExpand && e.nativeEvent.lines.length > maxLines) setNeedsExpand(true);
        }}
      >
        {text}
      </Text>
      {!isWeb && needsExpand && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
            {expanded ? 'Ver menos' : 'Ver mais'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────
function getTypeLabel(type: string): string {
  switch (type) {
    case 'prescription': return 'Receita';
    case 'exam': return 'Exame';
    case 'consultation': return 'Consulta';
    default: return type;
  }
}

function getTypeIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'prescription': return 'document-text';
    case 'exam': return 'flask';
    case 'consultation': return 'videocam';
    default: return 'document';
  }
}

function getPrescriptionTypeLabel(type: string | null): string {
  switch (type) {
    case 'simples': return 'Receita Simples';
    case 'controlado': return 'Receita Controlada';
    case 'azul': return 'Receita Azul';
    default: return '';
  }
}

function getRiskLabelPt(level: string | null | undefined): string {
  if (!level) return 'Risco não classificado';
  switch (level.toLowerCase()) {
    case 'high': return 'Risco alto';
    case 'medium': return 'Risco médio';
    case 'low': return 'Risco baixo';
    default: return 'Risco não classificado';
  }
}

function getNextActionIcon(intent: NextActionIntent): keyof typeof Ionicons.glyphMap {
  switch (intent) {
    case 'pay': return 'card-outline';
    case 'download': return 'download-outline';
    case 'wait': return 'time-outline';
    case 'support': return 'help-circle-outline';
    case 'track': return 'navigate-outline';
    default: return 'sparkles-outline';
  }
}

function getHeaderBg(type: string): string {
  return type === 'consultation' ? HEADER_BG_CONSULT : HEADER_BG_RX;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Section Card wrapper ───────────────────────────────────────
function SectionCard({ children, style }: { children: React.ReactNode; style?: any }) {
  const { colors } = useAppTheme();
  return (
    <View style={[{
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadows.card,
    }, style]}>
      {children}
    </View>
  );
}

function SectionHeader({ icon, iconColor, title, right }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  right?: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
      <View style={{
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: iconColor + '15',
        alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
      }}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.text }}>{title}</Text>
      {right}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────
export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Array.isArray(id) ? id[0] : id;
  const isValidRequestId = !!requestId && UUID_RE.test(requestId);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'doctor' && requestId) {
      router.replace(`/doctor-request/${requestId}`);
    }
  }, [user?.role, requestId, router]);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const listPadding = useListBottomPadding();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [documentActionLoading, setDocumentActionLoading] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const videoModalShownRef = useRef(false);
  const lastVideoModalRequestIdRef = useRef<string | null>(null);
  const { isConnected } = useNetworkStatus();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, windowWidth), [colors, windowWidth]);
  const { setModalOpen } = useModalVisibility();

  const {
    data: request,
    isLoading: loading,
    isError: hasError,
    error: queryError,
    refetch,
  } = useRequestDetailQuery(requestId);
  const cancelMutation = useCancelRequest();
  const markDeliveredMutation = useMarkDelivered();
  const detailError = hasError ? ((queryError as Error)?.message ?? String(queryError)) : null;
  const actionLoading = cancelMutation.isPending;

  // Modal visibility tracking (before any early return — Rules of Hooks)
  const isModalVisible =
    (showVideoModal && request && ['paid', 'in_consultation'].includes(request.status) && request.requestType === 'consultation') ||
    showConsentModal ||
    selectedImageUri !== null;

  useEffect(() => {
    setModalOpen(!!isModalVisible);
    return () => setModalOpen(false);
  }, [isModalVisible, setModalOpen]);

  /** Video popup: show when consultation is ready or doctor joined */
  useEffect(() => {
    if (!request || request.requestType !== 'consultation') return;
    if (request.id !== lastVideoModalRequestIdRef.current) {
      lastVideoModalRequestIdRef.current = request.id;
      videoModalShownRef.current = false;
    }
    const canJoin = ['paid', 'in_consultation'].includes(request.status);
    if (!canJoin) return;
    const shouldShow = request.status === 'in_consultation' || !videoModalShownRef.current;
    if (shouldShow) {
      videoModalShownRef.current = true;
      setShowVideoModal(true);
    }
  }, [request?.id, request?.status, request?.requestType, request]);

  /** Dra. Renova triage eval */
  useTriageEval({
    context: 'detail',
    step: 'idle',
    role: 'patient',
    status: request?.status ?? undefined,
    requestId: request?.id ?? undefined,
    doctorConductNotes: request?.doctorConductNotes ?? undefined,
  });

  // ─── Actions ────────────────────────────────────────────────
  const markAsDeliveredIfSigned = async () => {
    if (!requestId || !request || request.status !== 'signed') return;
    try {
      await markDeliveredMutation.mutateAsync(requestId);
    } catch {
      // Ignore; status may already be delivered
    }
  };

  const handleDownload = async () => {
    if (!requestId || documentActionLoading) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para baixar o documento.');
      return;
    }
    setDocumentActionLoading(true);
    try {
      await markAsDeliveredIfSigned();
      const downloadUrl = await getDocumentDownloadUrl(requestId);
      if (Sharing && FileSystem) {
        const fileName = `renoveja_${request!.requestType}_${request!.id.slice(0, 8)}.pdf`;
        const localUri = FileSystem.cacheDirectory + fileName;
        const download = await FileSystem.downloadAsync(downloadUrl, localUri);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(download.uri, { mimeType: 'application/pdf', dialogTitle: 'Salvar documento' });
          return;
        }
      }
      await WebBrowser.openBrowserAsync(downloadUrl);
    } catch (e: unknown) {
      try {
        const fallbackUrl = request?.signedDocumentUrl;
        if (fallbackUrl) {
          await WebBrowser.openBrowserAsync(fallbackUrl);
        } else {
          throw e;
        }
      } catch {
        Alert.alert('Erro', (e as Error)?.message || String(e) || 'Não foi possível baixar o documento');
      }
    } finally {
      setDocumentActionLoading(false);
    }
  };

  const handleViewDocument = async () => {
    if (!requestId || documentActionLoading) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para visualizar o documento.');
      return;
    }
    setDocumentActionLoading(true);
    try {
      await markAsDeliveredIfSigned();
      const viewUrl = await getDocumentDownloadUrl(requestId);
      await WebBrowser.openBrowserAsync(viewUrl);
    } catch (e: unknown) {
      Alert.alert('Erro', (e as Error)?.message || String(e) || 'Não foi possível abrir o documento.');
    } finally {
      setDocumentActionLoading(false);
    }
  };

  const handleCancel = () => {
    if (!requestId || !request) return;
    Alert.alert(
      'Cancelar pedido',
      'Tem certeza? Esta ação não pode ser desfeita.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync(requestId);
            } catch (e: unknown) {
              Alert.alert('Erro', (e as Error)?.message || String(e) || 'Não foi possível cancelar.');
            }
          },
        },
      ]
    );
  };

  // ─── Early returns (error / loading / not found) ──────────
  if (!isValidRequestId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.fallbackHeader, { backgroundColor: HEADER_BG_RX }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>Detalhes</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <AppEmptyState icon="alert-circle-outline" title="ID inválido" subtitle="O link acessado contém um identificador inválido. Volte e tente novamente." actionLabel="Voltar" onAction={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.fallbackHeader, { backgroundColor: HEADER_BG_RX }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>Carregando...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
          <SkeletonList count={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (!request && !detailError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.fallbackHeader, { backgroundColor: HEADER_BG_RX }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>Detalhes</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <AppEmptyState icon="document-text-outline" title="Solicitação não encontrada" subtitle="Este pedido pode ter sido removido ou não está mais disponível." actionLabel="Voltar" onAction={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (detailError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.fallbackHeader, { backgroundColor: HEADER_BG_RX }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>Detalhes</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <AppEmptyState icon="alert-circle-outline" title="Erro ao carregar" subtitle={detailError} actionLabel="Tentar novamente" onAction={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!request) return null;

  // ─── Derived state ────────────────────────────────────────
  const headerBg = getHeaderBg(request.requestType);
  const canDownload = !!request.signedDocumentUrl;
  const canJoinVideo = ['approved', 'paid', 'in_consultation'].includes(request.status) && request.requestType === 'consultation';
  const canCancel = ['submitted', 'in_review', 'approved', 'searching_doctor'].includes(request.status);
  const nextAction = getNextBestActionForRequest(request);
  const nextActionQuickCta =
    nextAction.intent === 'download' && canDownload
      ? { label: nextAction.ctaLabel ?? 'Baixar documento', onPress: handleDownload }
      : null;
  const isConsultation = request.requestType === 'consultation';

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* ─── Dark Header ─── */}
      <View style={[styles.darkHeader, { backgroundColor: headerBg }]}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <View style={styles.darkHeaderInner}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <View style={styles.headerTypeRow}>
                <Ionicons name={getTypeIcon(request.requestType)} size={18} color="rgba(255,255,255,0.85)" />
                <Text style={styles.headerTypeLabel}>{getTypeLabel(request.requestType)}</Text>
              </View>
              {request.prescriptionType && (
                <Text style={styles.headerSubLabel}>{getPrescriptionTypeLabel(request.prescriptionType)}</Text>
              )}
            </View>

            <StatusBadge status={request.status} size="sm" />
          </View>
        </SafeAreaView>
      </View>

      <FadeIn visible={!!request} {...motionTokens.fade.patient}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: listPadding + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Offline banner */}
          {isConnected === false && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
              <Text style={styles.offlineText}>Você está offline. Algumas ações estão temporariamente indisponíveis.</Text>
            </View>
          )}

          {/* Video ready banner */}
          {canJoinVideo && (
            <TouchableOpacity
              style={[styles.videoBanner, isConsultation && { backgroundColor: AI_ACCENT }]}
              onPress={() => { setShowVideoModal(false); setShowConsentModal(true); }}
              activeOpacity={0.85}
            >
              <View style={styles.videoBannerIcon}>
                <Ionicons name="videocam" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.videoBannerContent}>
                <Text style={styles.videoBannerTitle}>
                  {request.status === 'in_consultation' ? 'Médico na sala' : 'Sua consulta está pronta'}
                </Text>
                <Text style={styles.videoBannerSub}>
                  {request.status === 'in_consultation' ? 'Toque para entrar na videoconsulta' : 'Toque para entrar na sala de espera'}
                </Text>
              </View>
              <View style={styles.videoBannerArrow}>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
              </View>
            </TouchableOpacity>
          )}

          {/* ─── Status Tracker Card ─── */}
          <SectionCard>
            <SectionHeader icon="git-branch-outline" iconColor={colors.primary} title="Acompanhamento" />
            <StatusTracker currentStatus={request.status} requestType={request.requestType} />
          </SectionCard>

          {/* ─── Post-consultation documents ─── */}
          {isConsultation && (
            <View style={{ marginBottom: spacing.md }}>
              <ConsultationDocumentsCard requestId={request.id} requestType={request.requestType} />
            </View>
          )}

          {/* ─── Dra. Renoveja next action ─── */}
          <SectionCard>
            <SectionHeader icon="sparkles" iconColor={colors.primary} title="Dra. Renoveja" right={
              <View style={styles.nextActionBadge}>
                <Ionicons name={getNextActionIcon(nextAction.intent as NextActionIntent)} size={13} color={colors.primary} />
              </View>
            } />
            <Text style={styles.nextActionSummary}>{nextAction.statusSummary}</Text>
            <View style={styles.nextActionDivider} />
            <Text style={styles.nextActionStepLabel}>Próximo passo</Text>
            <Text style={styles.nextActionBody}>{nextAction.whatToDo}</Text>
            {nextAction.eta ? <Text style={styles.nextActionEta}>{nextAction.eta}</Text> : null}
            {nextActionQuickCta && (
              <AppButton
                title={nextActionQuickCta.label}
                icon={nextAction.intent === 'pay' ? 'card' : 'download'}
                onPress={nextActionQuickCta.onPress}
                loading={documentActionLoading || actionLoading}
                disabled={documentActionLoading || actionLoading}
                style={{ marginTop: spacing.md }}
              />
            )}
          </SectionCard>

          {/* ─── Auto observation + doctor conduct ─── */}
          {request.autoObservation && (
            <View style={{ marginBottom: spacing.md }}>
              <ObservationCard mode="auto" text={request.autoObservation} />
            </View>
          )}
          {request.doctorConductNotes && (
            <View style={{ marginBottom: spacing.md }}>
              <ObservationCard
                mode="conduct"
                text={request.doctorConductNotes}
                doctorName={request.doctorName}
                conductUpdatedAt={request.conductUpdatedAt ?? undefined}
              />
            </View>
          )}

          {/* ─── Document validity ─── */}
          {(request.requestType === 'prescription' || request.requestType === 'exam') && request.signedAt && (
            <View style={{ marginBottom: spacing.md }}>
              <DocumentValidityBadge request={request} />
            </View>
          )}

          {/* ─── Request Info Card ─── */}
          <SectionCard>
            <SectionHeader icon="information-circle-outline" iconColor={colors.info} title="Detalhes da solicitação" />
            <DetailRow label="Tipo" value={getTypeLabel(request.requestType)} colors={colors} />
            {request.prescriptionType && (
              <DetailRow label="Controle" value={getPrescriptionTypeLabel(request.prescriptionType)} colors={colors} />
            )}
            {request.doctorName && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Médico</Text>
                <View style={styles.doctorInfo}>
                  <View style={[styles.doctorAvatar, { backgroundColor: colors.primary }]}>
                    <Ionicons name="person" size={12} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{request.doctorName}</Text>
                </View>
              </View>
            )}
            <DetailRow label="Criado em" value={formatDateTimeBR(request.createdAt)} colors={colors} isLast />
          </SectionCard>

          {/* ─── Medications List ─── */}
          {request.medications && request.medications.length > 0 && (
            <SectionCard>
              <SectionHeader icon="medical" iconColor={colors.primary} title="Medicamentos" right={
                <View style={[styles.countBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.countBadgeText, { color: colors.primary }]}>{request.medications.length}</Text>
                </View>
              } />
              {request.medications.map((med, i) => (
                <View key={i} style={[styles.listItem, i === request.medications!.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.listDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.listItemText, { color: colors.text }]}>{med}</Text>
                </View>
              ))}
            </SectionCard>
          )}

          {/* ─── Exams List ─── */}
          {request.exams && request.exams.length > 0 && (
            <SectionCard>
              <SectionHeader icon="flask" iconColor={colors.info} title="Exames" right={
                <View style={[styles.countBadge, { backgroundColor: colors.info + '15' }]}>
                  <Text style={[styles.countBadgeText, { color: colors.info }]}>{request.exams.length}</Text>
                </View>
              } />
              {request.exams.map((exam, i) => (
                <View key={i} style={[styles.listItem, i === request.exams!.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.listDot, { backgroundColor: colors.info }]} />
                  <Text style={[styles.listItemText, { color: colors.text }]}>{exam}</Text>
                </View>
              ))}
            </SectionCard>
          )}

          {/* ─── Prescription Images ─── */}
          {request.prescriptionImages && request.prescriptionImages.length > 0 && (
            <SectionCard>
              <SectionHeader icon="images-outline" iconColor={colors.primary} title="Imagens da Receita" />
              <Text style={[styles.zoomHint, { color: colors.textMuted }]}>Toque para ampliar</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                {request.prescriptionImages.map((img, i) => (
                  <TouchableOpacity key={i} onPress={() => setSelectedImageUri(img)} activeOpacity={0.8} style={styles.thumbWrap}>
                    <CompatibleImage uri={img} style={styles.thumbImg} resizeMode="cover" />
                    <View style={[styles.zoomBadge, { backgroundColor: colors.overlayBackground }]}>
                      <Ionicons name="search" size={14} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </SectionCard>
          )}

          {/* ─── Exam Images ─── */}
          {request.examImages && request.examImages.length > 0 && (
            <SectionCard>
              <SectionHeader icon="images-outline" iconColor={colors.info} title="Imagens do Exame" />
              <Text style={[styles.zoomHint, { color: colors.textMuted }]}>Toque para ampliar</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                {request.examImages.map((img, i) => (
                  <TouchableOpacity key={i} onPress={() => setSelectedImageUri(img)} activeOpacity={0.8} style={styles.thumbWrap}>
                    <CompatibleImage uri={img} style={styles.thumbImg} resizeMode="cover" />
                    <View style={[styles.zoomBadge, { backgroundColor: colors.overlayBackground }]}>
                      <Ionicons name="search" size={14} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </SectionCard>
          )}

          {/* ─── Symptoms ─── */}
          {request.symptoms && (
            <SectionCard>
              <SectionHeader icon="chatbubble-ellipses-outline" iconColor={colors.warning} title="Sintomas" />
              <ExpandableText text={request.symptoms} maxLines={4} style={[styles.symptomsText, { color: colors.textSecondary }]} />
            </SectionCard>
          )}

          {/* ─── AI Summary (purple accent) ─── */}
          {request.aiSummaryForDoctor && (
            <View style={[styles.aiCard, { borderColor: AI_ACCENT + '30' }]}>
              <View style={styles.aiCardHeader}>
                <View style={[styles.aiIconWrap, { backgroundColor: AI_ACCENT + '15' }]}>
                  <Ionicons name="sparkles" size={17} color={AI_ACCENT} />
                </View>
                <Text style={[styles.aiCardTitle, { color: colors.text }]}>Análise IA</Text>
                {request.aiRiskLevel && (
                  <View style={[styles.riskBadge, {
                    backgroundColor: request.aiRiskLevel === 'high' ? colors.errorLight
                      : request.aiRiskLevel === 'medium' ? colors.warningLight
                      : colors.successLight,
                  }]}>
                    <Text style={[styles.riskText, {
                      color: request.aiRiskLevel === 'high' ? colors.error
                        : request.aiRiskLevel === 'medium' ? colors.warning
                        : colors.success,
                    }]}>
                      {getRiskLabelPt(request.aiRiskLevel)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[styles.aiDivider, { backgroundColor: AI_ACCENT + '15' }]} />
              <FormattedAiSummary text={request.aiSummaryForDoctor} accentColor={AI_ACCENT} />
            </View>
          )}

          {/* ─── Rejection reason ─── */}
          {request.rejectionReason && (
            <View style={[styles.rejectionCard, { backgroundColor: colors.errorLight, borderColor: colors.error + '25' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <Ionicons name="close-circle" size={20} color={colors.error} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.error }}>Motivo da Rejeição</Text>
              </View>
              <Text style={{ fontSize: 14, color: colors.error, lineHeight: 20 }}>{request.rejectionReason}</Text>
            </View>
          )}

          {/* ─── SUS Banner ─── */}
          <View style={styles.susBanner}>
            <View style={styles.susBannerIcon}>
              <Ionicons name="shield-checkmark" size={20} color="#22C55E" />
            </View>
            <View style={styles.susBannerContent}>
              <Text style={[styles.susBannerTitle, { color: colors.text }]}>Atendimento gratuito via SUS</Text>
              <Text style={[styles.susBannerSub, { color: colors.textSecondary }]}>
                Serviço digital de saúde pública
              </Text>
            </View>
          </View>

          {/* ─── Documents Section ─── */}
          {canDownload && (
            <SectionCard>
              <SectionHeader icon="document-attach-outline" iconColor="#22C55E" title="Documentos" />
              <AppButton
                title={request.requestType === 'exam' ? 'Baixar Pedido de Exame' : request.requestType === 'consultation' ? 'Baixar Documento' : 'Baixar Receita'}
                icon="download"
                onPress={handleDownload}
                loading={documentActionLoading}
                disabled={documentActionLoading}
              />
              <View style={{ height: spacing.sm }} />
              <AppButton
                title="Visualizar"
                icon="eye"
                variant="outline"
                onPress={handleViewDocument}
                disabled={documentActionLoading}
              />
              <View style={{ height: spacing.sm }} />
              <AppButton
                title="Enviar por WhatsApp"
                icon="logo-whatsapp"
                variant="outline"
                onPress={() => {/* TODO: implementar envio WhatsApp */}}
                style={{ borderColor: '#22C55E' }}
              />
            </SectionCard>
          )}

          {/* ─── Consultation auto-join card ─── */}
          {canJoinVideo && (
            <SectionCard style={{ borderWidth: 1, borderColor: colors.primary + '30', alignItems: 'center' }}>
              <View style={[styles.autoJoinIconWrap, { backgroundColor: colors.primary + '12' }]}>
                <Ionicons name="videocam" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.autoJoinTitle, { color: colors.text }]}>Consulta agendada</Text>
              <Text style={[styles.autoJoinSub, { color: colors.textSecondary }]}>
                Quando o médico iniciar a consulta, você será automaticamente levado à sala de vídeo.
              </Text>
            </SectionCard>
          )}

          {/* ─── Cancel Button ─── */}
          {canCancel && (
            <View style={{ marginTop: spacing.xs }}>
              <AppButton
                title="Cancelar pedido"
                icon="close-circle-outline"
                variant="outline"
                onPress={handleCancel}
                disabled={actionLoading}
                style={{ borderColor: colors.error + '50' }}
              />
            </View>
          )}
        </ScrollView>
      </FadeIn>

      {/* ─── Video Modal ─── */}
      <Modal
        visible={showVideoModal && canJoinVideo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVideoModal(false)}
        statusBarTranslucent
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowVideoModal(false)}>
          <TouchableOpacity style={styles.videoModalCard} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.videoModalIconWrap, { backgroundColor: isConsultation ? AI_ACCENT + '15' : colors.primary + '15' }]}>
              <Ionicons name="videocam" size={36} color={isConsultation ? AI_ACCENT : colors.primary} />
            </View>
            <Text style={[styles.videoModalTitle, { color: colors.text }]}>
              {request.status === 'in_consultation' ? 'Médico na sala!' : 'Sua consulta está pronta'}
            </Text>
            <Text style={[styles.videoModalSub, { color: colors.textSecondary }]}>
              {request.status === 'in_consultation'
                ? 'Entre na videoconsulta. Pode voltar a sala enquanto houver tempo contratado.'
                : 'Entre na sala e aguarde o médico.'}
            </Text>
            <TouchableOpacity
              style={[styles.videoModalPrimaryBtn, { backgroundColor: isConsultation ? AI_ACCENT : colors.primary }]}
              onPress={() => { setShowVideoModal(false); setShowConsentModal(true); }}
              activeOpacity={0.85}
            >
              <Ionicons name="videocam" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.videoModalPrimaryBtnText}>Entrar agora</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.videoModalSecBtn} onPress={() => setShowVideoModal(false)} activeOpacity={0.7}>
              <Text style={[styles.videoModalSecBtnText, { color: colors.textMuted }]}>Depois</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─── Consent Modal ─── */}
      <ConsultationConsentModal
        visible={showConsentModal}
        requestId={request.id}
        onAccepted={() => {
          setShowConsentModal(false);
          nav.replace(router, `/video/${request.id}`);
        }}
        onDeclined={() => setShowConsentModal(false)}
      />

      {/* ─── Image Zoom Modal ─── */}
      <Modal
        visible={selectedImageUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImageUri(null)}
        statusBarTranslucent
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
            <TouchableOpacity style={styles.imageModalClose} onPress={() => setSelectedImageUri(null)} activeOpacity={0.7}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            {selectedImageUri && (
              Platform.OS === 'web' && /\.(heic|heif)$/i.test(selectedImageUri) ? (
                <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <CompatibleImage uri={selectedImageUri} style={{ width: '100%', height: '100%', maxHeight: windowHeight * 0.8 }} resizeMode="contain" />
                </View>
              ) : (
                <ZoomableImage uri={selectedImageUri} onClose={() => setSelectedImageUri(null)} />
              )
            )}
          </View>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Detail Row sub-component ───────────────────────────────────
function DetailRow({ label, value, colors, isLast }: { label: string; value: string; colors: DesignColors; isLast?: boolean }) {
  return (
    <View style={[{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: colors.border,
    }]}>
      <Text style={{ fontSize: 14, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{value}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
function makeStyles(colors: DesignColors, screenWidth: number) {
  const isCompact = screenWidth < 360;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F8FAFC',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },

    // ── Dark Header ──
    darkHeader: {
      paddingBottom: spacing.md,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      ...shadows.card,
    },
    darkHeaderInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: 4,
      minHeight: 48,
    },
    fallbackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    headerBackBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTypeLabel: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    headerSubLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 2,
    },
    headerTitleText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      flex: 1,
      textAlign: 'center',
    },

    // ── Scroll ──
    scroll: {
      padding: spacing.md,
      paddingTop: spacing.lg,
    },

    // ── Offline Banner ──
    offlineBanner: {
      marginBottom: spacing.md,
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 12,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    offlineText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
    },

    // ── Video Banner ──
    videoBanner: {
      marginBottom: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      ...shadows.card,
    },
    videoBannerIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoBannerContent: {
      flex: 1,
    },
    videoBannerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    videoBannerSub: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 2,
    },
    videoBannerArrow: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Next Action ──
    nextActionBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary + '12',
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextActionSummary: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    nextActionDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.sm,
    },
    nextActionStepLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    nextActionBody: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    nextActionEta: {
      marginTop: 6,
      fontSize: 12,
      color: colors.textSecondary,
    },

    // ── Detail Rows ──
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailLabel: {
      fontSize: 14,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    doctorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    doctorAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Lists (meds / exams) ──
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    listDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    listItemText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
    },
    countBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },

    // ── Images ──
    thumbWrap: {
      marginHorizontal: 4,
      position: 'relative',
    },
    thumbImg: {
      width: isCompact ? 100 : 120,
      height: isCompact ? 100 : 120,
      borderRadius: 14,
    },
    zoomBadge: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      borderRadius: 12,
      padding: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomHint: {
      fontSize: 12,
      marginBottom: spacing.xs,
    },

    // ── Symptoms ──
    symptomsText: {
      fontSize: 14,
      lineHeight: 20,
    },

    // ── AI Card (purple accent) ──
    aiCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      ...shadows.card,
    },
    aiCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    aiIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiCardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
    },
    aiDivider: {
      height: 1,
      marginVertical: spacing.sm,
    },
    riskBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 8,
    },
    riskText: {
      fontSize: 12,
      fontWeight: '700',
    },

    // ── Rejection ──
    rejectionCard: {
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
    },

    // ── SUS Banner ──
    susBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#22C55E' + '0D', // 5% green
      borderRadius: 14,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: '#22C55E' + '25',
    },
    susBannerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#22C55E' + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    susBannerContent: {
      flex: 1,
    },
    susBannerTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    susBannerSub: {
      fontSize: 12,
      marginTop: 2,
    },

    // ── Auto join ──
    autoJoinIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    autoJoinTitle: {
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
    autoJoinSub: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 22,
      marginTop: 4,
    },

    // ── Modals ──
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    videoModalCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: spacing.xl,
      alignItems: 'center',
      minWidth: 280,
      maxWidth: 360,
      width: '100%',
      ...shadows.card,
    },
    videoModalIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    videoModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    videoModalSub: {
      fontSize: 15,
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 22,
    },
    videoModalPrimaryBtn: {
      width: '100%',
      flexDirection: 'row',
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    videoModalPrimaryBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    videoModalSecBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    videoModalSecBtnText: {
      fontSize: 14,
      fontWeight: '600',
    },

    // ── Image zoom modal ──
    imageModalClose: {
      position: 'absolute',
      top: Platform.OS === 'web' ? 20 : 60,
      right: spacing.md,
      zIndex: 10,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 22,
      padding: 8,
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}
