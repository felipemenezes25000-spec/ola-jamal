import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { fetchRequestById, markRequestDelivered, cancelRequest, getAssistantNextAction } from '../../lib/api';
import { apiClient } from '../../lib/api-client';
import { getDisplayPrice } from '../../lib/config/pricing';
import { formatBRL, formatDateTimeBR } from '../../lib/utils/format';
import { RequestResponseDto } from '../../types/database';
import { StatusBadge } from '../../components/StatusBadge';
import StatusTracker from '../../components/StatusTracker';
import { AppButton, StickyCTA, FormSection, AppEmptyState } from '../../components/ui';
import { ZoomableImage } from '../../components/ZoomableImage';
import { CompatibleImage } from '../../components/CompatibleImage';
import { FormattedAiSummary } from '../../components/FormattedAiSummary';
import { ObservationCard } from '../../components/triage';
import { useTriageEval } from '../../hooks/useTriageEval';
import { getNextBestActionForRequest, type NextActionIntent } from '../../lib/domain/assistantIntelligence';
import type { AssistantNextActionResponseData } from '../../lib/api';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

/** Texto expansível: mostra N linhas com "Ver mais" / "Ver menos". */
function ExpandableText({ text, maxLines = 4, style }: { text: string; maxLines?: number; style?: any }) {
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

const LOG_DETAIL = __DEV__ && false;

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const listPadding = useListBottomPadding();
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [nextActionFromApi, setNextActionFromApi] = useState<AssistantNextActionResponseData | null>(null);
  const [documentActionLoading, setDocumentActionLoading] = useState(false);
  const { isConnected } = useNetworkStatus();

  const fetchIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const payInFlightRef = useRef(false);

  /** Statuses em que o pagamento pode ser confirmado pelo webhook enquanto o usuário está na tela. */
  const AWAITING_PAYMENT_STATUSES = ['consultation_ready', 'approved_pending_payment', 'pending_payment'];

  const load = useCallback(async () => {
    if (!requestId) { setLoading(false); return; }
    const fid = ++fetchIdRef.current;
    const abort = new AbortController();
    abortRef.current = abort;

    setLoading(true);
    setDetailError(null);
    const start = Date.now();
    if (LOG_DETAIL) console.info('[DETAIL_FETCH] start', { requestId, fid });

    try {
      const data = await fetchRequestById(requestId, { signal: abort.signal });
      if (fid !== fetchIdRef.current) return;
      setRequest(data);
      if (LOG_DETAIL) console.info('[DETAIL_FETCH] success', { requestId, fid, ms: Date.now() - start });
    } catch (e: unknown) {
      if (fid !== fetchIdRef.current) return;
      if ((e as { name?: string })?.name === 'AbortError') return;
      const msg = (e as Error)?.message ?? String(e);
      setDetailError(msg);
      setRequest(null);
      if (LOG_DETAIL) console.info('[DETAIL_FETCH] error', { requestId, fid, msg });
    } finally {
      if (fid === fetchIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [requestId]);

  /** Refresh silencioso (sem loading) para refletir confirmação de pagamento pelo webhook. */
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const loadSilent = useCallback(async () => {
    if (!requestId) return;
    try {
      const data = await fetchRequestById(requestId);
      if (mountedRef.current) setRequest(data);
    } catch {
      // Ignore; não alterar estado em caso de erro no poll
    }
  }, [requestId]);

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  useFocusEffect(useCallback(() => { if (requestId) load(); }, [requestId, load]));

  /** Polling: enquanto o pedido está aguardando pagamento, atualiza a cada 5s para refletir webhook. Máx 180 polls (~15 min). */
  const MAX_POLLS = 180;
  const pollCountRef = useRef(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const awaiting = request && AWAITING_PAYMENT_STATUSES.includes(request.status);
    if (!awaiting) {
      pollCountRef.current = 0;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }
    pollCountRef.current = 0;
    const tick = () => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }
      loadSilent();
    };
    pollIntervalRef.current = setInterval(tick, 5000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [request?.status, request?.id, loadSilent]);

  /** Dra. Renova: mensagens no contexto do detalhe (conduta disponível, documento pronto). */
  useTriageEval({
    context: 'detail',
    step: 'idle',
    role: 'patient',
    status: request?.status ?? undefined,
    doctorConductNotes: request?.doctorConductNotes ?? undefined,
  });

  /** Next action da Dra.: API como fonte, fallback local em erro. */
  useEffect(() => {
    if (!request?.id) {
      setNextActionFromApi(null);
      return;
    }
    let cancelled = false;
    getAssistantNextAction({ requestId: request.id })
      .then((res) => {
        if (!cancelled) setNextActionFromApi(res);
      })
      .catch(() => {
        if (!cancelled) {
          const local = getNextBestActionForRequest(request);
          setNextActionFromApi({
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
  }, [request?.id]);

  const handlePay = () => {
    if (payInFlightRef.current) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para continuar para o pagamento.');
      return;
    }
    payInFlightRef.current = true;
    try {
      if (!request) return;
      const allowedToPay = ['approved_pending_payment', 'pending_payment'].includes(request.status) ||
        (request.requestType === 'consultation' && request.status === 'consultation_ready');
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
      const updated = await markRequestDelivered(requestId);
      setRequest(updated);
    } catch {
      // Ignore; status may already be delivered
    }
  };

  const handleDownload = async () => {
    if (!request?.signedDocumentUrl || documentActionLoading) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para baixar o documento.');
      return;
    }
    setDocumentActionLoading(true);
    try {
      await markAsDeliveredIfSigned();
      // Tenta compartilhar/salvar o PDF usando Sharing API; fallback para browser
      if (Sharing && FileSystem) {
        const fileName = `renoveja_${request.requestType}_${request.id.slice(0, 8)}.pdf`;
        const localUri = FileSystem.cacheDirectory + fileName;
        const download = await FileSystem.downloadAsync(request.signedDocumentUrl, localUri);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(download.uri, { mimeType: 'application/pdf', dialogTitle: 'Salvar documento' });
          return;
        }
      }
      // Fallback: abre no browser
      await WebBrowser.openBrowserAsync(request.signedDocumentUrl);
    } catch (e: unknown) {
      // Fallback: abre no browser se download/sharing falhar
      try {
        await WebBrowser.openBrowserAsync(request.signedDocumentUrl);
      } catch {
        Alert.alert('Erro', (e as Error)?.message || String(e) || 'Não foi possível baixar o documento');
      }
    } finally {
      setDocumentActionLoading(false);
    }
  };

  const handleViewDocument = async () => {
    if (!request?.signedDocumentUrl || documentActionLoading) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para visualizar o documento.');
      return;
    }
    setDocumentActionLoading(true);
    try {
      await markAsDeliveredIfSigned();
      await WebBrowser.openBrowserAsync(request.signedDocumentUrl);
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
            setActionLoading(true);
            try {
              const updated = await cancelRequest(requestId);
              setRequest(updated);
            } catch (e: unknown) {
              Alert.alert('Erro', (e as Error)?.message || String(e) || 'Não foi possível cancelar.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
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
            onAction={() => load()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!request) return null;

  // Backend aceita: ApprovedPendingPayment/PendingPayment (receita/exame) ou ConsultationReady (consulta)
  const canPay =
    ['approved_pending_payment', 'pending_payment'].includes(request.status) ||
    (request.requestType === 'consultation' && request.status === 'consultation_ready');
  const canDownload = !!request.signedDocumentUrl;
  const canJoinVideo = ['paid', 'in_consultation'].includes(request.status) && request.requestType === 'consultation';
  const canCancel = ['submitted', 'in_review', 'approved_pending_payment', 'pending_payment', 'searching_doctor', 'consultation_ready'].includes(request.status);
  const stickyBottomOffset = canPay ? 132 : 0;
  const nextActionLocal = getNextBestActionForRequest(request);
  const nextAction = nextActionFromApi ?? {
    title: nextActionLocal.title,
    statusSummary: nextActionLocal.statusSummary,
    whatToDo: nextActionLocal.whatToDo,
    eta: nextActionLocal.eta,
    ctaLabel: nextActionLocal.ctaLabel ?? null,
    intent: nextActionLocal.intent,
  };
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

const styles = StyleSheet.create({
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
  zoomBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 4, alignItems: 'center', justifyContent: 'center' },
  zoomHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center', alignItems: 'center' },
  modalCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 60,
    right: spacing.md,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    padding: 10,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
