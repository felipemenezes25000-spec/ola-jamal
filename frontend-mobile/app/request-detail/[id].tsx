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
import { spacing, borderRadius, shadows } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { uiTokens } from '../../lib/ui/tokens';
import { getDocumentDownloadUrl } from '../../lib/api';
import { useRequestDetailQuery, useCancelRequest, useMarkDelivered } from '../../lib/hooks/useRequestDetailQuery';
import { getDisplayPrice } from '../../lib/config/pricing';
import { formatBRL, formatDateTimeBR } from '../../lib/utils/format';
import { StatusBadge } from '../../components/StatusBadge';
import StatusTracker from '../../components/StatusTracker';
import { AppButton, StickyCTA, FormSection, AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { ZoomableImage } from '../../components/ZoomableImage';
import { CompatibleImage } from '../../components/CompatibleImage';
import { FormattedAiSummary } from '../../components/FormattedAiSummary';
import { ObservationCard } from '../../components/triage';
import { useTriageEval } from '../../hooks/useTriageEval';
import { getNextBestActionForRequest, type NextActionIntent } from '../../lib/domain/assistantIntelligence';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useModalVisibility } from '../../contexts/ModalVisibilityContext';

/** Texto expansível: mostra N linhas com "Ver mais" / "Ver menos". */
function ExpandableText({ text, maxLines = 4, style }: { text: string; maxLines?: number; style?: any }) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = React.useState(false);
  const [needsExpand, setNeedsExpand] = React.useState(false);
  return (
    <View>
      <Text
        style={style}
        numberOfLines={expanded ? undefined : maxLines}
        ellipsizeMode="tail"
        onTextLayout={(e) => {
          if (!needsExpand && e.nativeEvent.lines.length > maxLines) setNeedsExpand(true);
        }}
      >
        {text}
      </Text>
      {needsExpand && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
            {expanded ? 'Ver menos' : 'Ver mais'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'prescription': return 'Receita';
    case 'exam': return 'Exame';
    case 'consultation': return 'Consulta';
    default: return type;
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
    case 'pay':
      return 'card-outline';
    case 'download':
      return 'download-outline';
    case 'wait':
      return 'time-outline';
    case 'support':
      return 'help-circle-outline';
    case 'track':
      return 'navigate-outline';
    default:
      return 'sparkles-outline';
  }
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const listPadding = useListBottomPadding();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [documentActionLoading, setDocumentActionLoading] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const videoModalShownRef = useRef(false);
  const lastVideoModalRequestIdRef = useRef<string | null>(null);
  const payInFlightRef = useRef(false);
  const { isConnected } = useNetworkStatus();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

  // Modal visibility: deve ficar ANTES de qualquer early return para respeitar Rules of Hooks
  const isModalVisible =
    (showVideoModal && request && ['paid', 'in_consultation'].includes(request.status) && request.requestType === 'consultation') ||
    selectedImageUri !== null;

  useEffect(() => {
    setModalOpen(!!isModalVisible);
    return () => setModalOpen(false);
  }, [isModalVisible, setModalOpen]);

  /** Popup de vídeo: ao carregar com consulta pronta, mostra modal. Se status mudar para in_consultation (médico entrou), mostra de novo. */
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

  /** Dra. Renova: mensagens no contexto do detalhe (conduta disponível, documento pronto). */
  useTriageEval({
    context: 'detail',
    step: 'idle',
    role: 'patient',
    status: request?.status ?? undefined,
    requestId: request?.id ?? undefined,
    doctorConductNotes: request?.doctorConductNotes ?? undefined,
  });

  const handlePay = () => {
    if (payInFlightRef.current) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para continuar para o pagamento.');
      return;
    }
    payInFlightRef.current = true;
    try {
      if (!request) return;
      const allowedToPay = ['approved_pending_payment', 'pending_payment'].includes(request.status);
      if (!allowedToPay) {
        Alert.alert(
          'Pagamento indisponível',
          'Esta solicitação não está aguardando pagamento. O botão Pagar só aparece quando o pedido foi aprovado e está aguardando pagamento.'
        );
        return;
      }
      router.push(`/payment/request/${request.id}`);
    } finally {
      payInFlightRef.current = false;
    }
  };

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
      // Usa URL com token temporário via proxy do backend (evita expor URL do Supabase)
      const downloadUrl = await getDocumentDownloadUrl(requestId);
      // Tenta compartilhar/salvar o PDF usando Sharing API; fallback para browser
      if (Sharing && FileSystem) {
        const fileName = `renoveja_${request!.requestType}_${request!.id.slice(0, 8)}.pdf`;
        const localUri = FileSystem.cacheDirectory + fileName;
        const download = await FileSystem.downloadAsync(downloadUrl, localUri);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(download.uri, { mimeType: 'application/pdf', dialogTitle: 'Salvar documento' });
          return;
        }
      }
      // Fallback: abre no browser
      await WebBrowser.openBrowserAsync(downloadUrl);
    } catch (e: unknown) {
      // Fallback: abre no browser se download/sharing falhar
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Carregando...</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <SkeletonList count={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (!request && !detailError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.center}>
          <AppEmptyState
            icon="document-text-outline"
            title="Solicitação não encontrada"
            subtitle="Este pedido pode ter sido removido ou não está mais disponível."
            actionLabel="Voltar"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (detailError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.center}>
          <AppEmptyState
            icon="alert-circle-outline"
            title="Erro ao carregar"
            subtitle={detailError}
            actionLabel="Tentar novamente"
            onAction={() => refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!request) return null;

  // Backend aceita pagamento quando status está aguardando pagamento.
  const canPay =
    ['approved_pending_payment', 'pending_payment'].includes(request.status);
  const canDownload = !!request.signedDocumentUrl;
  const canJoinVideo = ['paid', 'in_consultation'].includes(request.status) && request.requestType === 'consultation';
  const canCancel = ['submitted', 'in_review', 'approved_pending_payment', 'pending_payment', 'searching_doctor'].includes(request.status);
  const stickyBottomOffset = canPay ? 132 : 0;
  // Sempre usar request atual — evita dessincronia (ex: polling atualiza para paid mas API retornava "falta pagamento")
  const nextAction = getNextBestActionForRequest(request);
  const nextActionQuickCta =
    nextAction.intent === 'pay' && canPay
      ? { label: nextAction.ctaLabel ?? 'Pagar agora', onPress: handlePay }
      : nextAction.intent === 'download' && canDownload
        ? { label: nextAction.ctaLabel ?? 'Baixar documento', onPress: handleDownload }
        : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getTypeLabel(request.requestType)}</Text>
        <StatusBadge status={request.status} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: listPadding + stickyBottomOffset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isConnected === false && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
            <Text style={styles.offlineText}>Você está offline. Algumas ações estão temporariamente indisponíveis.</Text>
          </View>
        )}

        {/* Popup/banner de vídeo: consulta pronta para entrar */}
        {canJoinVideo && (
          <TouchableOpacity
            style={styles.videoReadyBanner}
            onPress={() => { setShowVideoModal(false); nav.push(router, `/video/${request.id}`); }}
            activeOpacity={0.85}
          >
            <Ionicons name="videocam" size={28} color={colors.white} />
            <View style={styles.videoReadyBannerText}>
              <Text style={styles.videoReadyBannerTitle}>
                {request.status === 'in_consultation' ? 'Médico na sala — entre ou volte!' : 'Sua consulta está pronta'}
              </Text>
              <Text style={styles.videoReadyBannerSub}>
                {request.status === 'in_consultation' ? 'Toque para entrar ou voltar à videoconsulta' : 'Toque para entrar na videoconsulta'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.headerOverlayTextMuted} />
          </TouchableOpacity>
        )}

        {/* Status Tracker */}
        <FormSection
          title="Status do pedido"
          subtitle="Acompanhe cada etapa da solicitação"
          style={[styles.formSection, styles.formSectionFirst]}
          contentStyle={styles.formSectionContent}
        >
          <StatusTracker currentStatus={request.status} requestType={request.requestType} />
        </FormSection>

        <FormSection
          title="Dra. Renoveja"
          subtitle={nextAction.title}
          style={styles.formSection}
          contentStyle={styles.formSectionContent}
        >
          <View style={styles.nextActionHeader}>
            <View style={styles.nextActionIcon}>
              <Ionicons name={getNextActionIcon(nextAction.intent as NextActionIntent)} size={16} color={colors.primary} />
            </View>
            <Text style={styles.nextActionText}>{nextAction.statusSummary}</Text>
          </View>
          <Text style={styles.nextActionLabel}>Próximo passo</Text>
          <Text style={styles.nextActionBody}>{nextAction.whatToDo}</Text>
          <Text style={styles.nextActionEta}>{nextAction.eta}</Text>
          {nextActionQuickCta ? (
            <AppButton
              title={nextActionQuickCta.label}
              icon={nextAction.intent === 'pay' ? 'card' : 'download'}
              onPress={nextActionQuickCta.onPress}
              loading={documentActionLoading || actionLoading}
              disabled={documentActionLoading || actionLoading}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </FormSection>

        {/* Observação automática e conduta médica (Dra. Renoveja) */}
        {request.autoObservation && (
          <View style={styles.card}>
            <ObservationCard mode="auto" text={request.autoObservation} />
          </View>
        )}
        {request.doctorConductNotes && (
          <View style={styles.card}>
            <ObservationCard
              mode="conduct"
              text={request.doctorConductNotes}
              doctorName={request.doctorName}
              conductUpdatedAt={request.conductUpdatedAt ?? undefined}
            />
          </View>
        )}

        {/* Details Card */}
        <FormSection
          title="Detalhes da solicitação"
          subtitle="Informações principais do pedido"
          style={styles.formSection}
          contentStyle={styles.formSectionContent}
        >
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tipo</Text>
            <Text style={styles.detailValue}>{getTypeLabel(request.requestType)}</Text>
          </View>
          {request.prescriptionType && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Controle</Text>
              <Text style={styles.detailValue}>{getPrescriptionTypeLabel(request.prescriptionType)}</Text>
            </View>
          )}
          {request.doctorName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Médico</Text>
              <View style={styles.doctorInfo}>
                <View style={styles.doctorAvatarSmall}>
                  <Ionicons name="person" size={14} color={colors.white} />
                </View>
                <Text style={styles.detailValue}>{request.doctorName}</Text>
              </View>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Valor</Text>
            <Text style={[styles.detailValue, { color: colors.success, fontWeight: '700' }]}>
              {formatBRL(getDisplayPrice(request.price, request.requestType))}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Criado em</Text>
            <Text style={styles.detailValue}>
              {formatDateTimeBR(request.createdAt)}
            </Text>
          </View>
        </FormSection>

        {/* Medications */}
        {request.medications && request.medications.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="medical" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Medicamentos</Text>
            </View>
            {request.medications.map((med, i) => (
              <View key={i} style={styles.medItem}>
                <View style={styles.medIcon}>
                  <Ionicons name="ellipse" size={8} color={colors.primary} />
                </View>
                <Text style={styles.medName}>{med}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Prescription Images */}
        {request.prescriptionImages && request.prescriptionImages.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Imagens da Receita</Text>
            </View>
            <Text style={styles.zoomHint}>Toque para ampliar • Pinça para zoom</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.sm }}>
              {request.prescriptionImages.map((img, i) => (
                <TouchableOpacity key={i} onPress={() => setSelectedImageUri(img)} activeOpacity={0.8} style={styles.thumbWrap}>
                  <CompatibleImage uri={img} style={styles.thumbImg} resizeMode="cover" />
                  <View style={styles.zoomBadge}>
                    <Ionicons name="search" size={14} color={colors.white} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Exam Images */}
        {request.examImages && request.examImages.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images" size={20} color={colors.info} />
              <Text style={styles.cardTitle}>Imagens do Exame</Text>
            </View>
            <Text style={styles.zoomHint}>Toque para ampliar • Pinça para zoom</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.sm }}>
              {request.examImages.map((img, i) => (
                <TouchableOpacity key={i} onPress={() => setSelectedImageUri(img)} activeOpacity={0.8} style={styles.thumbWrap}>
                  <CompatibleImage uri={img} style={styles.thumbImg} resizeMode="cover" />
                  <View style={styles.zoomBadge}>
                    <Ionicons name="search" size={14} color={colors.white} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Exams */}
        {request.exams && request.exams.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="flask" size={20} color={colors.info} />
              <Text style={styles.cardTitle}>Exames</Text>
            </View>
            {request.exams.map((exam, i) => (
              <View key={i} style={styles.medItem}>
                <View style={styles.medIcon}>
                  <Ionicons name="ellipse" size={8} color={colors.info} />
                </View>
                <Text style={styles.medName}>{exam}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Symptoms */}
        {request.symptoms && (
          <FormSection
            title="Sintomas"
            subtitle="Relato informado no momento do pedido"
            style={styles.formSection}
            contentStyle={styles.formSectionContent}
          >
            <ExpandableText text={request.symptoms} maxLines={4} style={styles.symptomsText} />
          </FormSection>
        )}

        {/* AI Analysis */}
        {request.aiSummaryForDoctor && (
          <View style={[styles.card, { backgroundColor: colors.warningLight }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles" size={20} color={colors.warning} />
              <Text style={styles.cardTitle}>Análise IA</Text>
              {request.aiRiskLevel && (
                <View style={[styles.riskBadge, { backgroundColor: request.aiRiskLevel === 'high' ? colors.errorLight : request.aiRiskLevel === 'medium' ? colors.warningLight : colors.successLight }]}>
                  <Text style={[styles.riskText, { color: request.aiRiskLevel === 'high' ? colors.error : request.aiRiskLevel === 'medium' ? colors.warning : colors.success }]}>
                    {getRiskLabelPt(request.aiRiskLevel)}
                  </Text>
                </View>
              )}
            </View>
            <FormattedAiSummary text={request.aiSummaryForDoctor} accentColor={colors.warning} />
          </View>
        )}

        {/* Rejection */}
        {request.rejectionReason && (
          <View style={[styles.card, { backgroundColor: colors.errorLight }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={[styles.cardTitle, { color: colors.error }]}>Motivo da Rejeição</Text>
            </View>
            <Text style={[styles.symptomsText, { color: colors.error }]}>{request.rejectionReason}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {canDownload && (
            <>
              <AppButton
                title={request.requestType === 'exam' ? 'Baixar Pedido de Exame' : request.requestType === 'consultation' ? 'Baixar Documento' : 'Baixar Receita'}
                icon="download"
                onPress={handleDownload}
                loading={documentActionLoading}
                disabled={documentActionLoading}
              />
              <AppButton
                title="Visualizar"
                icon="eye"
                variant="outline"
                onPress={handleViewDocument}
                disabled={documentActionLoading}
              />
            </>
          )}

          {canJoinVideo && (
            <View style={styles.autoJoinCard}>
              <Ionicons name="videocam" size={24} color={colors.primary} />
              <Text style={styles.autoJoinTitle}>Consulta agendada</Text>
              <Text style={styles.autoJoinSub}>
                Quando o médico iniciar a consulta, você será automaticamente levado à sala de vídeo. Não é necessário clicar em nada.
              </Text>
            </View>
          )}

          {canCancel && (
            <AppButton
              title="Cancelar pedido"
              icon="close-circle-outline"
              variant="outline"
              onPress={handleCancel}
              disabled={actionLoading}
              style={{ borderColor: colors.textMuted }}
            />
          )}
        </View>
      </ScrollView>

      {canPay && (
        <StickyCTA
          summaryTitle="Total"
          summaryValue={formatBRL(getDisplayPrice(request.price, request.requestType))}
          summaryHint="Pagamento seguro. Você pode revisar antes."
          secondary={{ label: 'Voltar', onPress: () => router.back() }}
          primary={{ label: 'Pagar agora', onPress: handlePay, loading: actionLoading, disabled: actionLoading }}
        />
      )}

      {/* Modal popup de vídeo: "Entre na consulta" */}
      <Modal
        visible={showVideoModal && canJoinVideo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVideoModal(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.videoModalOverlay}
          activeOpacity={1}
          onPress={() => setShowVideoModal(false)}
        >
          <TouchableOpacity
            style={styles.videoModalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Ionicons name="videocam" size={48} color={colors.primary} style={{ marginBottom: spacing.md }} />
            <Text style={styles.videoModalTitle}>
              {request.status === 'in_consultation' ? 'Médico na sala!' : 'Sua consulta está pronta'}
            </Text>
            <Text style={styles.videoModalSub}>
              {request.status === 'in_consultation'
                ? 'Entre na videoconsulta. Pode voltar à sala enquanto houver tempo contratado.'
                : 'Entre na sala e aguarde o médico.'}
            </Text>
            <TouchableOpacity
              style={styles.videoModalBtn}
              onPress={() => { setShowVideoModal(false); nav.push(router, `/video/${request.id}`); }}
              activeOpacity={0.85}
            >
              <Text style={styles.videoModalBtnText}>Entrar agora</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.videoModalBtnSec}
              onPress={() => setShowVideoModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.videoModalBtnSecText}>Depois</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal com zoom nas imagens */}
      <Modal
        visible={selectedImageUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImageUri(null)}
        statusBarTranslucent
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedImageUri(null)} activeOpacity={0.7}>
              <Ionicons name="close" size={32} color={colors.white} />
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

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: 14, color: colors.textMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: spacing.md, paddingTop: spacing.lg },
  offlineBanner: {
    marginBottom: spacing.md,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  offlineText: { flex: 1, fontSize: 12, color: colors.textSecondary },
  videoReadyBanner: {
    marginBottom: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  videoReadyBannerText: { flex: 1 },
  videoReadyBannerTitle: { fontSize: 16, fontWeight: '700', color: colors.white },
  videoReadyBannerSub: { fontSize: 13, color: colors.headerOverlayTextMuted, marginTop: 2 },
  videoModalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  videoModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 340,
    ...shadows.card,
  },
  videoModalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  videoModalSub: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  videoModalBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  videoModalBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  videoModalBtnSec: { paddingVertical: 8, paddingHorizontal: 16 },
  videoModalBtnSecText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  formSection: { marginHorizontal: -spacing.md },
  formSectionFirst: { marginTop: 0 },
  formSectionContent: {
    borderRadius: 16,
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.2, marginBottom: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: { fontSize: 14, color: colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '500', color: colors.text },
  doctorInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doctorAvatarSmall: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  medItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  medIcon: { width: 24, alignItems: 'center' },
  medName: { fontSize: 15, color: colors.text, fontWeight: '500' },
  symptomsText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  nextActionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  nextActionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '15',
    marginTop: 1,
  },
  nextActionText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  nextActionLabel: {
    marginTop: spacing.sm,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  nextActionBody: { fontSize: 14, lineHeight: 20, color: colors.text },
  nextActionEta: { marginTop: 6, fontSize: 12, color: colors.textSecondary },
  aiSummary: { fontSize: 14, color: colors.warning, lineHeight: 20 },
  riskBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  riskText: { fontSize: 12, fontWeight: '700' },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginHorizontal: uiTokens.screenPaddingHorizontal - spacing.md,
  },
  autoJoinCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    ...shadows.card,
  },
  autoJoinTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  autoJoinSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  errorTitle: { fontSize: 18, fontWeight: '600', color: colors.textSecondary },
  errorMsg: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  errorBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  errorBtnText: { fontSize: 15, fontWeight: '600', color: colors.white },
  thumbWrap: { marginHorizontal: spacing.sm, position: 'relative' },
  thumbImg: { width: 120, height: 120, borderRadius: 14 },
  zoomBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: colors.overlayBackground, borderRadius: 12, padding: 4, alignItems: 'center', justifyContent: 'center' },
  zoomHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  modalContainer: { flex: 1, backgroundColor: colors.modalOverlay, justifyContent: 'center', alignItems: 'center' },
  modalCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 60,
    right: spacing.md,
    zIndex: 10,
    backgroundColor: colors.modalOverlay,
    borderRadius: 25,
    padding: 10,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  });
}
