import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../../lib/themeDoctor';
import {
  getRequestById,
  approveRequest,
  rejectRequest,
  signRequest,
  acceptConsultation,
} from '../../lib/api';
import { getDisplayPrice } from '../../lib/config/pricing';
import { RequestResponseDto } from '../../types/database';
import StatusTracker from '../../components/StatusTracker';
import { StatusBadge } from '../../components/StatusBadge';
import { ZoomableImage } from '../../components/ZoomableImage';
import { CompatibleImage } from '../../components/CompatibleImage';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { showToast } from '../../components/ui/Toast';

const TYPE_LABELS: Record<string, string> = { prescription: 'Receita', exam: 'Exame', consultation: 'Consulta' };
const RISK_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  low: { bg: colors.successLight, text: colors.success, icon: 'shield-checkmark' },
  medium: { bg: colors.warningLight, text: '#D97706', icon: 'alert-circle' },
  high: { bg: colors.errorLight, text: colors.destructive, icon: 'warning' },
};
const RISK_LABELS_PT: Record<string, string> = {
  low: 'Risco baixo',
  medium: 'Risco médio',
  high: 'Risco alto',
};
const URGENCY_LABELS_PT: Record<string, string> = {
  routine: 'Rotina',
  urgent: 'Urgente',
  emergency: 'Emergência',
};

function hasUsefulAiContent(aiSummary: string | null | undefined, aiRisk?: string | null, aiUrgency?: string | null): boolean {
  if (aiRisk || aiUrgency) return true;
  if (!aiSummary || !aiSummary.trim()) return false;
  return aiSummary.replace(/\s/g, '').length > 50;
}

export default function DoctorRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const requestId = (Array.isArray(id) ? id[0] : id) ?? '';
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [showSignForm, setShowSignForm] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!requestId) return;
    try { setRequest(await getRequestById(requestId)); }
    catch { console.error('Error loading request'); }
    finally { setLoading(false); }
  }, [requestId]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { if (requestId) loadData(); }, [requestId, loadData]));

  const executeApprove = async () => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      await approveRequest(requestId);
      await loadData();
      showToast({ message: 'Solicitação aprovada com sucesso!', type: 'success' });
    } catch (e: unknown) {
      showToast({ message: (e as Error)?.message || 'Falha ao aprovar.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Confirma a aprovação?')) executeApprove();
    } else {
      Alert.alert('Aprovar', 'Confirma a aprovação?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprovar', onPress: executeApprove },
      ]);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { showToast({ message: 'Informe o motivo da rejeição.', type: 'warning' }); return; }
    if (!requestId) return;
    setActionLoading(true);
    try { await rejectRequest(requestId, rejectionReason.trim()); loadData(); setShowRejectForm(false); showToast({ message: 'Pedido rejeitado.', type: 'info' }); }
    catch (e: unknown) { showToast({ message: (e as Error)?.message || 'Falha ao rejeitar.', type: 'error' }); }
    finally { setActionLoading(false); }
  };

  const handleSign = async () => {
    if (!certPassword.trim()) { showToast({ message: 'Digite a senha do certificado.', type: 'warning' }); return; }
    if (!requestId) return;
    setActionLoading(true);
    try {
      await signRequest(requestId, { pfxPassword: certPassword });
      loadData(); setShowSignForm(false); setCertPassword('');
      showToast({ message: 'Documento assinado digitalmente!', type: 'success' });
    } catch (e: unknown) {
      setCertPassword('');
      showToast({ message: (e as Error)?.message || 'Senha incorreta ou erro na assinatura.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptConsultation = async () => {
    if (!requestId) return;
    setActionLoading(true);
    try { await acceptConsultation(requestId); loadData(); showToast({ message: 'Consulta aceita!', type: 'success' }); }
    catch (e: unknown) { showToast({ message: (e as Error)?.message || 'Falha ao aceitar.', type: 'error' }); }
    finally { setActionLoading(false); }
  };

  const fmt = (d: string) => {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const canApprove = request && (request.status === 'submitted' || request.status === 'in_review') && request.requestType !== 'consultation';
  const canReject = request && (request.status === 'submitted' || request.status === 'in_review');
  const canSign = request && request.status === 'paid' && request.requestType !== 'consultation';
  const canAccept = request && request.status === 'searching_doctor' && request.requestType === 'consultation';
  const canVideo = request && ['paid', 'in_consultation'].includes(request.status) && request.requestType === 'consultation';
  const isInQueue = request && request.status === 'submitted' && !request.doctorId;

  if (loading) return (
    <View style={s.loadingContainer}>
      <View style={[s.navHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Carregando...</Text>
        <View style={s.navSpacer} />
      </View>
      <View style={{ padding: spacing.md }}><SkeletonList count={4} /></View>
    </View>
  );

  if (!request) return (
    <View style={s.center}>
      <Ionicons name="document-text-outline" size={56} color={colors.textMuted} />
      <Text style={s.emptyTitle}>Pedido não encontrado</Text>
      <TouchableOpacity onPress={() => router.back()} style={s.emptyAction}>
        <Text style={s.emptyActionText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Nav Header */}
        <View style={[s.navHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={s.navTitle}>{TYPE_LABELS[request.requestType] || 'Pedido'}</Text>
          <StatusBadge status={request.status} />
        </View>

        {/* Status tracker */}
        <View style={s.card}><StatusTracker currentStatus={request.status} requestType={request.requestType} /></View>

        {/* Patient */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>PACIENTE</Text>
          <TouchableOpacity onPress={() => request.patientId && router.push(`/doctor-patient/${request.patientId}` as any)} activeOpacity={0.7}>
            <Row k="Nome" v={request.patientName || 'N/A'} />
            {request.patientId && (
              <View style={s.patientLink}>
                <Ionicons name="folder-open-outline" size={14} color={colors.primary} />
                <Text style={s.patientLinkText}>Ver histórico (prontuário)</Text>
              </View>
            )}
          </TouchableOpacity>
          <Row k="Criado em" v={fmt(request.createdAt)} />
        </View>

        {/* Details */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>DETALHES</Text>
          <Row k="Tipo" v={TYPE_LABELS[request.requestType]} />
          {request.prescriptionType && <Row k="Modalidade" v={request.prescriptionType === 'simples' ? 'Simples' : request.prescriptionType === 'controlado' ? 'Controlada' : 'Azul'} warn={request.prescriptionType === 'controlado'} />}
          <Row k="Valor" v={`R$ ${getDisplayPrice(request.price, request.requestType).toFixed(2).replace('.', ',')}`} accent />
        </View>

        {/* AI Copilot */}
        {hasUsefulAiContent(request.aiSummaryForDoctor, request.aiRiskLevel, request.aiUrgency) && (
          <View style={[s.card, s.aiCard]}>
            <View style={s.aiHeader}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={s.aiTitle}>AI Copilot</Text>
              {request.aiRiskLevel && (
                <View style={[s.riskBadge, { backgroundColor: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.bg || colors.muted }]}>
                  <Ionicons name={(RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.icon || 'alert-circle') as any} size={12} color={RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text} />
                  <Text style={[s.riskText, { color: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text }]}>
                    {RISK_LABELS_PT[request.aiRiskLevel.toLowerCase()] || request.aiRiskLevel}
                  </Text>
                </View>
              )}
            </View>
            {/* AI Disclaimer */}
            <View style={s.aiDisclaimer}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
              <Text style={s.aiDisclaimerText}>Sugestões geradas por IA — decisão final do médico.</Text>
            </View>
            {request.aiSummaryForDoctor && request.aiSummaryForDoctor.trim().length > 0 && (
              <Text style={s.aiSummary}>{request.aiSummaryForDoctor}</Text>
            )}
            {request.aiUrgency && (
              <View style={s.urgencyRow}>
                <Ionicons name="time" size={14} color={colors.textSecondary} />
                <Text style={s.urgencyText}>Urgência: {URGENCY_LABELS_PT[request.aiUrgency.toLowerCase()] || request.aiUrgency}</Text>
              </View>
            )}
          </View>
        )}

        {/* Prescription Images */}
        {request.prescriptionImages && request.prescriptionImages.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>IMAGENS DA RECEITA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {request.prescriptionImages.map((img, i) => (
                <TouchableOpacity key={i} onPress={() => setSelectedImageUri(img)} activeOpacity={0.8}>
                  <CompatibleImage uri={img} style={s.img} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Exam Images */}
        {request.examImages && request.examImages.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>IMAGENS DO EXAME</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {request.examImages.map((img, i) => (
                <TouchableOpacity key={i} onPress={() => setSelectedImageUri(img)} activeOpacity={0.8}>
                  <CompatibleImage uri={img} style={s.img} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Zoomable Image Modal */}
        <Modal
          visible={selectedImageUri !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedImageUri(null)}
          statusBarTranslucent
        >
          <View style={s.modalContainer}>
            <TouchableOpacity style={s.modalCloseButton} onPress={() => setSelectedImageUri(null)} activeOpacity={0.7}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            {selectedImageUri && (
              <View style={s.modalImageWrapper}>
                {Platform.OS === 'web' && /\.(heic|heif)$/i.test(selectedImageUri) ? (
                  <CompatibleImage uri={selectedImageUri} style={s.modalImageFull} resizeMode="contain" />
                ) : (
                  <ZoomableImage uri={selectedImageUri} onClose={() => setSelectedImageUri(null)} />
                )}
              </View>
            )}
          </View>
        </Modal>

        {/* Medications */}
        {request.medications && request.medications.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>MEDICAMENTOS</Text>
            {request.medications.map((m, i) => <MedItem key={i} text={m} icon="medical" iconColor={colors.primary} iconBg={colors.primarySoft} />)}
          </View>
        )}

        {/* Exams */}
        {request.exams && request.exams.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>EXAMES SOLICITADOS</Text>
            {request.exams.map((e, i) => <MedItem key={i} text={e} icon="flask" iconColor={colors.primary} iconBg={colors.accentSoft} />)}
          </View>
        )}

        {/* Symptoms */}
        {request.symptoms && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>SINTOMAS</Text>
            <Text style={s.symptomsText}>{request.symptoms}</Text>
          </View>
        )}

        {/* Sign Form */}
        {showSignForm && (
          <View style={[s.card, s.formCard]}>
            <View style={s.formHeader}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={s.formTitle}>ASSINATURA DIGITAL</Text>
            </View>
            <Text style={s.formDesc}>Digite a senha do seu certificado A1 para assinar:</Text>
            <TextInput
              style={s.formInput}
              placeholder="Senha do certificado"
              secureTextEntry
              value={certPassword}
              onChangeText={setCertPassword}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={s.formBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowSignForm(false); setCertPassword(''); }}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.signBtn} onPress={handleSign} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : (
                  <><Ionicons name="shield-checkmark" size={18} color="#fff" /><Text style={s.actionBtnText}>Assinar</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Reject Form */}
        {showRejectForm && (
          <View style={[s.card, s.formCard]}>
            <Text style={s.formTitle}>REJEIÇÃO</Text>
            <TextInput
              style={s.formTextArea}
              placeholder="Descreva o motivo da rejeição..."
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              textAlignVertical="top"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={s.formBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowRejectForm(false)}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.rejectBtn} onPress={handleReject} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.actionBtnText}>Rejeitar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Queue hint */}
        {isInQueue && (
          <View style={s.queueHint}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={s.queueHintText}>Pedido na fila. Aprove para enviar ao pagamento ou rejeite informando o motivo.</Text>
          </View>
        )}

        {/* Actions */}
        {!showSignForm && !showRejectForm && (
          <View style={s.actions}>
            {canAccept && <ActionBtn bg={colors.secondary} icon="checkmark" text="Aceitar Consulta" onPress={handleAcceptConsultation} loading={actionLoading} />}
            {canApprove && <ActionBtn bg={colors.primary} icon="checkmark-circle" text="Aprovar" onPress={handleApprove} loading={actionLoading} />}
            {canSign && request.requestType === 'prescription' && (
              <ActionBtn bg={colors.primary} icon="document-text" text="Visualizar e Assinar" onPress={() => router.push(`/doctor-request/editor/${requestId}`)} />
            )}
            {canSign && request.requestType !== 'prescription' && (
              <ActionBtn bg={colors.primary} icon="shield-checkmark" text="Assinar Digitalmente" onPress={() => setShowSignForm(true)} />
            )}
            {canVideo && <ActionBtn bg={colors.secondary} icon="videocam" text="Iniciar Consulta" onPress={() => router.push(`/video/${request.id}`)} />}
            {canReject && (
              <TouchableOpacity style={s.rejectOutline} onPress={() => setShowRejectForm(true)} activeOpacity={0.7}>
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                <Text style={s.rejectOutlineText}>Rejeitar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---- Sub-components ---- */

function Row({ k, v, accent, warn }: { k: string; v: string; accent?: boolean; warn?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowKey}>{k}</Text>
      {warn ? (
        <View style={s.warnBadge}>
          <Ionicons name="warning" size={12} color="#D97706" /><Text style={s.warnText}>{v}</Text>
        </View>
      ) : <Text style={[s.rowValue, accent && { color: colors.primary, fontWeight: '700' }]}>{v}</Text>}
    </View>
  );
}

function MedItem({ text, icon, iconColor, iconBg }: { text: string; icon: string; iconColor: string; iconBg: string }) {
  return (
    <View style={s.medItem}>
      <View style={[s.medIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={14} color={iconColor} />
      </View>
      <Text style={s.medText}>{text}</Text>
    </View>
  );
}

function ActionBtn({ bg, icon, text, onPress, loading }: { bg: string; icon: string; text: string; onPress: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity style={[s.actionBtn, { backgroundColor: bg }]} onPress={onPress} disabled={loading} activeOpacity={0.8}>
      {loading ? <ActivityIndicator color="#fff" /> : (
        <>
          <Ionicons name={icon as any} size={20} color="#fff" />
          <Text style={s.actionBtnText}>{text}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/* ---- Styles ---- */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: spacing.md },
  emptyTitle: { fontSize: 16, fontFamily: typography.fontFamily.medium, color: colors.textSecondary },
  emptyAction: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.md, marginTop: spacing.sm },
  emptyActionText: { fontSize: 15, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: '#fff' },

  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  navTitle: { fontSize: 18, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text },
  navSpacer: { width: 40 },

  card: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: borderRadius.card, padding: spacing.md, ...shadows.card },
  sectionLabel: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm, textTransform: 'uppercase' },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowKey: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },
  rowValue: { fontSize: 14, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.text },
  warnBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warningLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  warnText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: '#D97706' },

  patientLink: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  patientLinkText: { fontSize: 12, fontFamily: typography.fontFamily.semibold, color: colors.primary, fontWeight: '600' },

  // AI Copilot
  aiCard: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.accent },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  aiTitle: { fontSize: 17, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text, flex: 1 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
  riskText: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700' },
  aiDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(0,119,182,0.06)', borderRadius: 6 },
  aiDisclaimerText: { fontSize: 11, fontFamily: typography.fontFamily.regular, color: colors.textMuted, fontStyle: 'italic' },
  aiSummary: { fontSize: 15, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 24, marginBottom: spacing.sm },
  urgencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  urgencyText: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },

  // Images
  img: { width: 180, height: 180, borderRadius: 14, marginRight: spacing.sm },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center', alignItems: 'center' },
  modalImageWrapper: { flex: 1, width: '100%', alignSelf: 'stretch' },
  modalImageFull: { flex: 1, width: '100%', minHeight: 300 },
  modalCloseButton: { position: 'absolute', top: Platform.OS === 'web' ? 20 : 60, right: spacing.md, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 25, padding: 10, width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },

  // Medications/Exams
  medItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  medIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  medText: { fontSize: 14, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.text, flex: 1 },

  // Symptoms
  symptomsText: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, lineHeight: 20 },

  // Queue hint
  queueHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: borderRadius.card },
  queueHintText: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },

  // Actions
  actions: { marginHorizontal: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  actionBtn: { flexDirection: 'row', padding: spacing.md, borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, ...shadows.button },
  actionBtnText: { fontSize: 16, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: '#fff' },
  rejectOutline: { flexDirection: 'row', padding: spacing.md, borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1.5, borderColor: colors.error },
  rejectOutlineText: { fontSize: 15, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.error },

  // Forms
  formCard: { borderWidth: 1, borderColor: colors.border },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  formTitle: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  formDesc: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, marginBottom: spacing.md },
  formInput: { backgroundColor: colors.background, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, height: 48, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, fontFamily: typography.fontFamily.regular },
  formTextArea: { backgroundColor: colors.background, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 100, borderWidth: 1, borderColor: colors.border, fontFamily: typography.fontFamily.regular },
  formBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.card, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { fontSize: 15, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.textSecondary },
  signBtn: { flex: 1, flexDirection: 'row', backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.card, alignItems: 'center', justifyContent: 'center', gap: 6 },
  rejectBtn: { flex: 1, backgroundColor: colors.error, padding: spacing.md, borderRadius: borderRadius.card, alignItems: 'center' },
});
