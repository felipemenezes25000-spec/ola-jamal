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
  Linking,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, borderRadius, shadows } from '../../lib/themeDoctor';
import { fetchRequestById, markRequestDelivered, cancelRequest } from '../../lib/api';
import { getDisplayPrice } from '../../lib/config/pricing';
import { formatBRL, formatDateBR } from '../../lib/utils/format';
import { RequestResponseDto } from '../../types/database';
import { StatusBadge } from '../../components/StatusBadge';
import StatusTracker from '../../components/StatusTracker';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { ZoomableImage } from '../../components/ZoomableImage';
import { CompatibleImage } from '../../components/CompatibleImage';
import { FormattedAiSummary } from '../../components/FormattedAiSummary';

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

const LOG_DETAIL = __DEV__ && false;

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const fetchIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  useFocusEffect(useCallback(() => { if (requestId) load(); }, [requestId, load]));

  const handlePay = () => {
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
    if (!request?.signedDocumentUrl) return;
    try {
      await markAsDeliveredIfSigned();
      if (Platform.OS === 'web') {
        window?.open?.(request.signedDocumentUrl, '_blank');
        return;
      }
      await Linking.openURL(request.signedDocumentUrl);
    } catch (e: unknown) {
      Alert.alert('Erro', (e as Error)?.message || String(e) || 'Não foi possível baixar o documento');
    }
  };

  const handleViewDocument = async () => {
    if (!request?.signedDocumentUrl) return;
    try {
      await markAsDeliveredIfSigned();
      await WebBrowser.openBrowserAsync(request.signedDocumentUrl);
    } catch (e: unknown) {
      Alert.alert('Erro', (e as Error)?.message || String(e) || 'Não foi possível abrir o documento.');
    }
  };

  const handleEnterConsultation = () => {
    if (!request) return;
    router.push(`/video/${request.id}`);
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={64} color={colors.border} />
          <Text style={styles.errorTitle}>Solicitação não encontrada</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={() => router.back()}>
            <Text style={styles.errorBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (detailError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={styles.errorTitle}>Erro ao carregar</Text>
          <Text style={styles.errorMsg}>{detailError}</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={() => load()}>
            <Text style={styles.errorBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getTypeLabel(request.requestType)}</Text>
        <StatusBadge status={request.status} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status Tracker */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>STATUS DO PEDIDO</Text>
          <StatusTracker currentStatus={request.status} requestType={request.requestType} />
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Detalhes da Solicitação</Text>
          </View>
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
                  <Ionicons name="person" size={14} color="#fff" />
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
              {formatDateBR(request.createdAt)} {new Date(request.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

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
                    <Ionicons name="search" size={14} color="#fff" />
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
                    <Ionicons name="search" size={14} color="#fff" />
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
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="chatbubble-ellipses" size={20} color={colors.warning} />
              <Text style={styles.cardTitle}>Sintomas</Text>
            </View>
            <Text style={styles.symptomsText} numberOfLines={4} ellipsizeMode="tail">{request.symptoms}</Text>
          </View>
        )}

        {/* AI Analysis */}
        {request.aiSummaryForDoctor && (
          <View style={[styles.card, { backgroundColor: '#FFFBEB' }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles" size={20} color="#F59E0B" />
              <Text style={styles.cardTitle}>Análise IA</Text>
              {request.aiRiskLevel && (
                <View style={[styles.riskBadge, { backgroundColor: request.aiRiskLevel === 'high' ? '#FEE2E2' : request.aiRiskLevel === 'medium' ? '#FEF3C7' : '#D1FAE5' }]}>
                  <Text style={[styles.riskText, { color: request.aiRiskLevel === 'high' ? '#EF4444' : request.aiRiskLevel === 'medium' ? '#D97706' : '#059669' }]}>
                    {request.aiRiskLevel === 'high' ? 'ALTO RISCO' : request.aiRiskLevel === 'medium' ? 'RISCO MÉDIO' : 'BAIXO RISCO'}
                  </Text>
                </View>
              )}
            </View>
            <FormattedAiSummary text={request.aiSummaryForDoctor} accentColor="#D97706" />
          </View>
        )}

        {/* Rejection */}
        {request.rejectionReason && (
          <View style={[styles.card, { backgroundColor: '#FEE2E2' }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={[styles.cardTitle, { color: colors.error }]}>Motivo da Rejeição</Text>
            </View>
            <Text style={[styles.symptomsText, { color: '#991B1B' }]}>{request.rejectionReason}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {canPay && (
            <PrimaryButton
              label="Pagar"
              icon="qr-code"
              onPress={handlePay}
              loading={actionLoading}
              disabled={actionLoading}
            />
          )}

          {canDownload && (
            <>
              <PrimaryButton
                label="Baixar Receita"
                icon="download"
                onPress={handleDownload}
              />
              <PrimaryButton
                label="Visualizar"
                icon="eye"
                variant="outline"
                onPress={handleViewDocument}
              />
            </>
          )}

          {canJoinVideo && (
            <PrimaryButton
              label="Entrar na Consulta"
              icon="videocam"
              onPress={handleEnterConsultation}
              style={{ backgroundColor: colors.success, borderColor: colors.success }}
            />
          )}

          {canCancel && (
            <PrimaryButton
              label="Cancelar pedido"
              icon="close-circle-outline"
              variant="outline"
              onPress={handleCancel}
              disabled={actionLoading}
              style={{ borderColor: colors.textMuted }}
            />
          )}
        </View>
      </ScrollView>

      {/* Modal com zoom nas imagens */}
      <Modal
        visible={selectedImageUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImageUri(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedImageUri(null)} activeOpacity={0.7}>
            <Ionicons name="close" size={32} color="#fff" />
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
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: spacing.md, paddingTop: spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.xs },
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
  aiSummary: { fontSize: 14, color: '#92400E', lineHeight: 20 },
  riskBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  riskText: { fontSize: 11, fontWeight: '700' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  errorTitle: { fontSize: 18, fontWeight: '600', color: colors.textSecondary },
  errorMsg: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  errorBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  errorBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  thumbWrap: { marginHorizontal: spacing.sm, position: 'relative' },
  thumbImg: { width: 120, height: 120, borderRadius: 14 },
  zoomBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 4, alignItems: 'center', justifyContent: 'center' },
  zoomHint: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.xs },
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
