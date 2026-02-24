import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useListBottomPadding } from '../../lib/ui/responsive';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, doctorDS } from '../../lib/themeDoctor';
import {
  getRequestById,
  approveRequest,
  rejectRequest,
  signRequest,
  acceptConsultation,
} from '../../lib/api';
import { getDisplayPrice } from '../../lib/config/pricing';
import { formatBRL } from '../../lib/utils/format';
import { RequestResponseDto } from '../../types/database';
import StatusTracker from '../../components/StatusTracker';
import { StatusBadge } from '../../components/StatusBadge';
import { DoctorHeader } from '../../components/ui/DoctorHeader';
import { DoctorCard } from '../../components/ui/DoctorCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { ZoomableImage } from '../../components/ZoomableImage';
import { CompatibleImage } from '../../components/CompatibleImage';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { showToast } from '../../components/ui/Toast';
import { parseAiSummary } from '../../components/FormattedAiSummary';

/* ---- In-memory cache for instant display ---- */
const _requestCache = new Map<string, RequestResponseDto>();
export function cacheRequest(r: RequestResponseDto) { _requestCache.set(r.id, r); }

const TYPE_LABELS: Record<string, string> = { prescription: 'RECEITA', exam: 'EXAME', consultation: 'CONSULTA' };
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
  const listPadding = useListBottomPadding();
  const requestId = (Array.isArray(id) ? id[0] : id) ?? '';
  const cached = _requestCache.get(requestId);
  const [request, setRequest] = useState<RequestResponseDto | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [showSignForm, setShowSignForm] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [aiSummaryExpanded, setAiSummaryExpanded] = useState(false);
  const loadData = useCallback(async () => {
    if (!requestId) return;
    try {
      const fresh = await getRequestById(requestId);
      // DEBUG: verificar se imagens chegam na resposta da API
      console.log('[DOCTOR_DETAIL] prescriptionImages:', JSON.stringify(fresh.prescriptionImages));
      console.log('[DOCTOR_DETAIL] examImages:', JSON.stringify(fresh.examImages));
      setRequest(fresh);
      _requestCache.set(requestId, fresh);
    } catch { console.error('Error loading request'); }
    finally { setLoading(false); }
  }, [requestId]);

  // Single load on focus (covers mount + re-focus). No separate useEffect.
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

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
      <DoctorHeader title="Carregando..." onBack={() => router.back()} />
      <View style={{ padding: spacing.md }}><SkeletonList count={4} /></View>
    </View>
  );

  if (!request) return (
    <View style={s.center}>
      <Ionicons name="document-text-outline" size={56} color={colors.textMuted} />
      <Text style={s.emptyTitle}>PEDIDO NÃO ENCONTRADO</Text>
      <TouchableOpacity onPress={() => router.back()} style={s.emptyAction}>
        <Text style={s.emptyActionText}>VOLTAR</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DoctorHeader
        title={TYPE_LABELS[request.requestType] || 'Pedido'}
        onBack={() => router.back()}
        right={<StatusBadge status={request.status} />}
      />
      <ScrollView style={s.container} contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: listPadding }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Status tracker */}
        <DoctorCard style={s.cardMargin}><StatusTracker currentStatus={request.status} requestType={request.requestType} /></DoctorCard>

        {/* Patient */}
        <DoctorCard style={s.cardMargin}>
          <TouchableOpacity
            onPress={() => request.patientId && router.push(`/doctor-patient/${request.patientId}` as any)}
            activeOpacity={0.7}
            style={s.patientRow}
          >
            <View style={s.patientAvatar}>
              <Text style={s.patientAvatarText}>{getInitials(request.patientName)}</Text>
            </View>
            <View style={s.patientInfo}>
              <Text style={s.patientName}>{request.patientName || 'Paciente'}</Text>
              <Text style={s.patientDate}>{fmt(request.createdAt)}</Text>
              {request.patientId && (
                <View style={s.patientLink}>
                  <Ionicons name="folder-open-outline" size={13} color={colors.primary} />
                  <Text style={s.patientLinkText}>VER PRONTUÁRIO</Text>
                  <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                </View>
              )}
            </View>
          </TouchableOpacity>
        </DoctorCard>

        {/* Details */}
        <DoctorCard style={s.cardMargin}>
          <View style={s.detailsGrid}>
            <View style={s.detailItem}>
              <Text style={s.detailItemLabel}>TIPO</Text>
              <View style={s.detailChip}>
                <Ionicons name={request.requestType === 'prescription' ? 'document-text' : request.requestType === 'exam' ? 'flask' : 'videocam'} size={14} color={colors.primary} />
                <Text style={s.detailChipText}>{TYPE_LABELS[request.requestType]}</Text>
              </View>
            </View>
            {request.prescriptionType && (
              <View style={s.detailItem}>
                <Text style={s.detailItemLabel}>MODALIDADE</Text>
                <View style={[s.detailChip, request.prescriptionType === 'controlado' && s.detailChipWarn, request.prescriptionType === 'azul' && s.detailChipInfo]}>
                  {request.prescriptionType === 'controlado' && <Ionicons name="warning" size={13} color="#D97706" />}
                  <Text style={[s.detailChipText, request.prescriptionType === 'controlado' && { color: '#D97706' }, request.prescriptionType === 'azul' && { color: colors.info }]}>
                    {request.prescriptionType === 'simples' ? 'Simples' : request.prescriptionType === 'controlado' ? 'Controlada' : 'Azul'}
                  </Text>
                </View>
              </View>
            )}
            <View style={s.detailItem}>
              <Text style={s.detailItemLabel}>VALOR</Text>
              <Text style={s.detailPrice}>{formatBRL(getDisplayPrice(request.price, request.requestType))}</Text>
            </View>
          </View>
        </DoctorCard>

        {/* AI Copilot (Copiloto IA) */}
        {hasUsefulAiContent(request.aiSummaryForDoctor, request.aiRiskLevel, request.aiUrgency) && (
          <DoctorCard style={[s.cardMargin, s.aiCard]}>
            <View style={s.aiHeader}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={s.aiTitle}>COPILOTO IA</Text>
              {request.aiRiskLevel && (
                <View style={[s.riskBadge, { backgroundColor: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.bg || colors.muted }]}>
                  <Ionicons name={(RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.icon || 'alert-circle') as any} size={12} color={RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text} />
                  <Text style={[s.riskText, { color: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text }]}>
                    {RISK_LABELS_PT[request.aiRiskLevel.toLowerCase()] || request.aiRiskLevel}
                  </Text>
                </View>
              )}
            </View>
            <View style={s.aiDisclaimer}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
              <Text style={s.aiDisclaimerText}>Sugestões geradas por IA — decisão final do médico.</Text>
            </View>
            {request.aiSummaryForDoctor && request.aiSummaryForDoctor.trim().length > 0 && (() => {
              const blocks = parseAiSummary(request.aiSummaryForDoctor);
              const shouldTruncate = !aiSummaryExpanded && blocks.length > 6;
              const displayBlocks = shouldTruncate ? blocks.slice(0, 6) : blocks;
              return (
                <View style={s.aiSummarySection}>
                  {displayBlocks.map((block, i) => {
                    if (block.type === 'header') {
                      return (
                        <View key={i} style={[s.aiBlock, i > 0 && s.aiBlockSpaced]}>
                          <Text style={s.aiBlockHeader}>{block.header}</Text>
                          {block.content ? <Text style={s.aiBlockContent}>{block.content}</Text> : null}
                        </View>
                      );
                    }
                    if (block.type === 'bullet') {
                      return (
                        <View key={i} style={s.aiBulletRow}>
                          <View style={s.aiBulletDot} />
                          <Text style={s.aiBulletText}>{block.content}</Text>
                        </View>
                      );
                    }
                    return <Text key={i} style={s.aiBlockContent}>{block.content}</Text>;
                  })}
                  {shouldTruncate && <Text style={s.aiTruncatedHint}>...</Text>}
                  <View style={s.aiSummaryActions}>
                    {blocks.length > 6 && (
                      <TouchableOpacity style={s.aiSummaryActionBtn} onPress={() => setAiSummaryExpanded(!aiSummaryExpanded)}>
                        <Text style={s.aiSummaryActionText}>{aiSummaryExpanded ? 'Ver menos' : 'Ver mais'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={s.aiSummaryActionBtn}
                      onPress={async () => {
                        await Clipboard.setStringAsync(request.aiSummaryForDoctor || '');
                        showToast({ message: 'Copiado para a área de transferência', type: 'success' });
                      }}
                    >
                      <Ionicons name="copy-outline" size={14} color={colors.primary} />
                      <Text style={s.aiSummaryActionText}>Copiar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
            {request.aiUrgency && (
              <View style={s.urgencyRow}>
                <Ionicons name="time" size={14} color={colors.textSecondary} />
                <Text style={s.urgencyText}>Urgência: {URGENCY_LABELS_PT[request.aiUrgency.toLowerCase()] || request.aiUrgency}</Text>
              </View>
            )}
          </DoctorCard>
        )}

        {/* Prescription Images */}
        {request.prescriptionImages && request.prescriptionImages.length > 0 && (
          <DoctorCard style={s.cardMargin}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconWrap, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="image" size={16} color={colors.primary} />
              </View>
              <Text style={s.sectionLabel}>IMAGENS DA RECEITA</Text>
              <Text style={s.zoomHint}>Toque para ampliar</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.imageScroll}>
              {request.prescriptionImages.map((img, i) => (
                <TouchableOpacity key={i} onPress={() => setSelectedImageUri(img)} activeOpacity={0.8} style={s.thumbContainer}>
                  <CompatibleImage uri={img} style={s.img} resizeMode="cover" />
                  <View style={s.zoomBadge}>
                    <Ionicons name="expand" size={14} color="#fff" />
                  </View>
                  {request.prescriptionImages!.length > 1 && (
                    <View style={s.imgCounter}>
                      <Text style={s.imgCounterText}>{i + 1}/{request.prescriptionImages!.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </DoctorCard>
        )}

        {/* Exam Images */}
        {request.examImages && request.examImages.length > 0 && (
          <DoctorCard style={s.cardMargin}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconWrap, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="image" size={16} color={colors.primary} />
              </View>
              <Text style={s.sectionLabel}>IMAGENS DO EXAME</Text>
              <Text style={s.zoomHint}>Toque para ampliar</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.imageScroll}>
              {request.examImages.map((img, i) => (
                <TouchableOpacity key={i} onPress={() => setSelectedImageUri(img)} activeOpacity={0.8} style={s.thumbContainer}>
                  <CompatibleImage uri={img} style={s.img} resizeMode="cover" />
                  <View style={s.zoomBadge}>
                    <Ionicons name="expand" size={14} color="#fff" />
                  </View>
                  {request.examImages!.length > 1 && (
                    <View style={s.imgCounter}>
                      <Text style={s.imgCounterText}>{i + 1}/{request.examImages!.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </DoctorCard>
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
          <DoctorCard style={s.cardMargin}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconWrap, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="medical" size={16} color={colors.primary} />
              </View>
              <Text style={s.sectionLabel}>MEDICAMENTOS</Text>
              <View style={s.sectionCountBadge}>
                <Text style={s.sectionCountText}>{request.medications.length}</Text>
              </View>
            </View>
            {request.medications.map((m, i) => (
              <View key={i} style={[s.medCard, i > 0 && s.medCardBorder]}>
                <View style={s.medIndex}>
                  <Text style={s.medIndexText}>{i + 1}</Text>
                </View>
                <Text style={s.medCardText}>{m}</Text>
              </View>
            ))}
          </DoctorCard>
        )}

        {/* Exams */}
        {request.exams && request.exams.length > 0 && (
          <DoctorCard style={s.cardMargin}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconWrap, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="flask" size={16} color={colors.primary} />
              </View>
              <Text style={s.sectionLabel}>EXAMES SOLICITADOS</Text>
              <View style={s.sectionCountBadge}>
                <Text style={s.sectionCountText}>{request.exams.length}</Text>
              </View>
            </View>
            {request.exams.map((e, i) => (
              <View key={i} style={[s.medCard, i > 0 && s.medCardBorder]}>
                <View style={[s.medIndex, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[s.medIndexText, { color: colors.primaryDark }]}>{i + 1}</Text>
                </View>
                <Text style={s.medCardText}>{e}</Text>
              </View>
            ))}
          </DoctorCard>
        )}

        {/* Symptoms */}
        {request.symptoms && (
          <DoctorCard style={s.cardMargin}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconWrap, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="chatbubble-ellipses" size={16} color={colors.warning} />
              </View>
              <Text style={s.sectionLabel}>SINTOMAS RELATADOS</Text>
            </View>
            <View style={s.symptomsBlock}>
              <Text style={s.symptomsText}>{request.symptoms}</Text>
            </View>
          </DoctorCard>
        )}

        {/* Consultation transcript & anamnesis (prontuário pós-consulta) */}
        {request.requestType === 'consultation' && request.status === 'consultation_finished' && (request.consultationTranscript || request.consultationAnamnesis || request.consultationAiSuggestions) && (
          <>
            {/* Anamnese estruturada com campos visuais */}
            {request.consultationAnamnesis && request.consultationAnamnesis.trim() && (() => {
              let ana: Record<string, any> = {};
              try { ana = JSON.parse(request.consultationAnamnesis || '{}'); } catch {}
              const anamnesisFields: Array<{ key: string; label: string; icon: string }> = [
                { key: 'queixa_principal', label: 'Queixa Principal', icon: 'chatbubble-ellipses' },
                { key: 'historia_doenca_atual', label: 'História da Doença Atual', icon: 'time' },
                { key: 'sintomas', label: 'Sintomas', icon: 'thermometer' },
                { key: 'medicamentos_em_uso', label: 'Medicamentos em Uso', icon: 'medical' },
                { key: 'alergias', label: 'Alergias', icon: 'warning' },
                { key: 'antecedentes_relevantes', label: 'Antecedentes', icon: 'document-text' },
                { key: 'cid_sugerido', label: 'CID Sugerido', icon: 'code-slash' },
              ];
              return (
                <DoctorCard style={[s.cardMargin, s.aiCard]}>
                  <View style={s.aiHeader}>
                    <Ionicons name="document-text" size={18} color={colors.primary} />
                    <Text style={s.aiTitle}>ANAMNESE ESTRUTURADA</Text>
                    <View style={[s.riskBadge, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="sparkles" size={10} color={colors.primary} />
                      <Text style={[s.riskText, { color: colors.primary }]}>IA</Text>
                    </View>
                  </View>
                  <View style={s.aiDisclaimer}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={s.aiDisclaimerText}>Gerado por IA — revisão médica obrigatória. CFM Res. 2.299/2021.</Text>
                  </View>
                  {anamnesisFields.map(({ key, label, icon }) => {
                    const val = ana[key];
                    if (!val || (typeof val === 'string' && !val.trim())) return null;
                    const display = Array.isArray(val) ? val.join(', ') : String(val);
                    const isAlert = key === 'alergias';
                    const isCid = key === 'cid_sugerido';
                    return (
                      <View key={key} style={s.anaField}>
                        <View style={s.anaLabelRow}>
                          <Ionicons name={icon as any} size={12} color={isAlert ? colors.destructive : colors.textMuted} />
                          <Text style={[s.anaLabel, isAlert && { color: colors.destructive }]}>{label}</Text>
                        </View>
                        <Text style={[s.anaValue, isCid && { color: colors.primary, fontFamily: typography.fontFamily.bold }]}>{display}</Text>
                      </View>
                    );
                  })}
                  {/* Red flags */}
                  {Array.isArray(ana.alertas_vermelhos) && ana.alertas_vermelhos.length > 0 && (
                    <View style={s.redFlagBlock}>
                      <View style={s.anaLabelRow}>
                        <Ionicons name="alert-circle" size={14} color="#EF4444" />
                        <Text style={[s.anaLabel, { color: '#EF4444' }]}>ALERTAS DE GRAVIDADE</Text>
                      </View>
                      {(ana.alertas_vermelhos as string[]).map((flag, i) => (
                        <View key={i} style={s.redFlagItem}>
                          <Text style={s.redFlagText}>{flag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </DoctorCard>
              );
            })()}

            {/* Sugestões clínicas e medicamentos */}
            {(request.consultationAiSuggestions || (() => {
              try {
                const ana = JSON.parse(request.consultationAnamnesis || '{}');
                return Array.isArray(ana.medicamentos_sugeridos) && ana.medicamentos_sugeridos.length > 0;
              } catch { return false; }
            })()) && (
              <DoctorCard style={[s.cardMargin, { borderWidth: 1, borderColor: colors.accent }]}>
                <View style={s.aiHeader}>
                  <Ionicons name="bulb" size={18} color="#8B5CF6" />
                  <Text style={s.aiTitle}>SUGESTÕES CLÍNICAS DA IA</Text>
                </View>
                {request.consultationAiSuggestions && (() => {
                  try {
                    const items = JSON.parse(request.consultationAiSuggestions || '[]') as string[];
                    return items.map((item, i) => {
                      const isRedFlag = item.startsWith('🚨');
                      return (
                        <View key={i} style={[s.suggestionItem, isRedFlag && s.suggestionItemDanger]}>
                          <Ionicons name={isRedFlag ? 'alert-circle' : 'bulb-outline'} size={16} color={isRedFlag ? '#EF4444' : '#8B5CF6'} />
                          <Text style={[s.suggestionText, isRedFlag && { color: '#EF4444' }]}>{item.replace('🚨 ', '')}</Text>
                        </View>
                      );
                    });
                  } catch { return null; }
                })()}
                {/* Medicamentos sugeridos como chips */}
                {(() => {
                  try {
                    const ana = JSON.parse(request.consultationAnamnesis || '{}');
                    const meds: string[] = Array.isArray(ana.medicamentos_sugeridos) ? ana.medicamentos_sugeridos : [];
                    if (meds.length === 0) return null;
                    return (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[s.anaLabel, { marginBottom: 6 }]}>MEDICAMENTOS SUGERIDOS</Text>
                        <View style={s.medChipsRow}>
                          {meds.map((m, i) => (
                            <TouchableOpacity key={i} style={s.medChip} onPress={async () => {
                              await Clipboard.setStringAsync(m);
                              showToast({ message: 'Copiado!', type: 'success' });
                            }}>
                              <Text style={s.medChipText}>{m}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  } catch { return null; }
                })()}
              </DoctorCard>
            )}

            {/* Transcrição completa (collapsible) */}
            {request.consultationTranscript && request.consultationTranscript.trim() && (
              <DoctorCard style={s.cardMargin}>
                <View style={s.aiHeader}>
                  <Ionicons name="mic" size={18} color={colors.textMuted} />
                  <Text style={s.aiTitle}>TRANSCRIÇÃO DA CONSULTA</Text>
                  <TouchableOpacity
                    style={s.aiSummaryActionBtn}
                    onPress={async () => {
                      await Clipboard.setStringAsync(request.consultationTranscript || '');
                      showToast({ message: 'Transcrição copiada', type: 'success' });
                    }}
                  >
                    <Ionicons name="copy-outline" size={14} color={colors.primary} />
                    <Text style={s.aiSummaryActionText}>Copiar</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.aiDisclaimer}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                  <Text style={s.aiDisclaimerText}>Transcrição automática — pode conter imprecisões.</Text>
                </View>
                <Text style={[s.aiSummary, { fontSize: 13, lineHeight: 21, color: colors.textSecondary }]}>
                  {request.consultationTranscript}
                </Text>
              </DoctorCard>
            )}

            {/* CTA: criar prescrição baseada na consulta */}
            {(() => {
              try {
                const ana = JSON.parse(request.consultationAnamnesis || '{}');
                const meds: string[] = Array.isArray(ana.medicamentos_sugeridos) ? ana.medicamentos_sugeridos : [];
                if (meds.length === 0) return null;
                return (
                  <View style={[s.cardMargin, { marginBottom: 8 }]}>
                    <PrimaryButton
                      label="Criar Receita Baseada na Consulta"
                      showArrow
                      onPress={() => {
                        router.push({
                          pathname: '/doctor-request/editor/[id]' as any,
                          params: {
                            id: request.id,
                            prefillMeds: JSON.stringify(meds),
                          },
                        });
                      }}
                      style={{ width: '100%' }}
                    />
                  </View>
                );
              } catch { return null; }
            })()}
          </>
        )}

        {/* Sign Form */}
        {showSignForm && (
          <DoctorCard style={[s.cardMargin, s.formCard]}>
            <View style={s.formHeader}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={s.formTitle}>ASSINATURA DIGITAL</Text>
            </View>
            <Text style={s.formDesc}>Digite a senha do seu certificado A1 para assinar</Text>
            <TextInput
              style={s.formInput}
              placeholder="Senha do certificado"
              secureTextEntry
              value={certPassword}
              onChangeText={setCertPassword}
              placeholderTextColor={colors.textMuted}
            />
            <View style={s.formBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowSignForm(false); setCertPassword(''); }}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <PrimaryButton label="Assinar" onPress={handleSign} loading={actionLoading} style={s.primaryBtnFlex} />
            </View>
          </DoctorCard>
        )}

        {/* Reject Form */}
        {showRejectForm && (
          <DoctorCard style={[s.cardMargin, s.formCard]}>
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
              <PrimaryButton
                label="Rejeitar"
                variant="danger"
                onPress={handleReject}
                loading={actionLoading}
                style={s.primaryBtnFlex}
              />
            </View>
          </DoctorCard>
        )}

        {/* Queue hint */}
        {isInQueue && (
          <View style={s.queueHint}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={s.queueHintText}>Pedido na fila. Aprove para enviar ao pagamento ou rejeite informando o motivo.</Text>
          </View>
        )}

        {/* Signed Document */}
        {request.signedDocumentUrl && (
          <DoctorCard style={s.cardMargin}>
            <View style={s.sectionHeader}>
              <Ionicons name="document-text" size={18} color={colors.success} />
              <Text style={s.sectionTitle}>DOCUMENTO ASSINADO</Text>
            </View>
            <TouchableOpacity
              style={s.pdfBtn}
              onPress={() => {
                if (Platform.OS === 'web') {
                  (window as any)?.open?.(request.signedDocumentUrl, '_blank');
                } else {
                  WebBrowser.openBrowserAsync(request.signedDocumentUrl!);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={20} color={colors.primary} />
              <Text style={s.pdfBtnText}>Visualizar PDF Assinado</Text>
            </TouchableOpacity>
          </DoctorCard>
        )}

        {/* Actions */}
        {!showSignForm && !showRejectForm && (
          <View style={s.actions}>
            {canAccept && <PrimaryButton label="Aceitar Consulta" onPress={handleAcceptConsultation} loading={actionLoading} style={s.actionBtnFull} />}
            {canApprove && <PrimaryButton label="Aprovar" onPress={handleApprove} loading={actionLoading} style={s.actionBtnFull} />}
            {canSign && request.requestType === 'prescription' && (
              <PrimaryButton label="Visualizar e Assinar" showArrow onPress={() => router.push(`/doctor-request/editor/${requestId}`)} style={s.actionBtnFull} />
            )}
            {canSign && request.requestType !== 'prescription' && (
              <PrimaryButton label="Assinar Digitalmente" onPress={() => setShowSignForm(true)} style={s.actionBtnFull} />
            )}
            {canVideo && <PrimaryButton label="Iniciar Consulta" showArrow onPress={() => router.push(`/video/${request.id}`)} style={s.actionBtnFull} />}
            {canReject && (
              <PrimaryButton
                label="Rejeitar"
                variant="outline-danger"
                onPress={() => setShowRejectForm(true)}
                style={s.actionBtnFull}
              />
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---- Helpers ---- */

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0][0] || '?').toUpperCase();
}

/* ---- Styles ---- */

const pad = doctorDS.screenPaddingHorizontal;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: spacing.md },
  emptyTitle: { fontSize: 14, fontFamily: typography.fontFamily.bold, color: colors.textSecondary, letterSpacing: 0.8 },
  emptyAction: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.md, marginTop: spacing.sm },
  emptyActionText: { fontSize: 13, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: '#fff', letterSpacing: 0.6 },

  cardMargin: { marginHorizontal: pad, marginTop: spacing.md },

  // Section headers with icon
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', flex: 1, marginBottom: 2 },
  sectionCountBadge: { backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionCountText: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary },

  // Patient card - avatar + info
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  patientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  patientAvatarText: { fontSize: 18, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: '#fff' },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 16, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.text },
  patientDate: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, marginTop: 2 },
  patientLink: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  patientLinkText: { fontSize: 11, fontFamily: typography.fontFamily.bold, color: colors.primary, fontWeight: '700', letterSpacing: 0.5 },

  // Details grid
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailItem: { minWidth: 80 },
  detailItemLabel: { fontSize: 10, fontFamily: typography.fontFamily.bold, color: colors.textMuted, marginBottom: 6, letterSpacing: 1 },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  detailChipWarn: { backgroundColor: colors.warningLight },
  detailChipInfo: { backgroundColor: colors.infoLight },
  detailChipText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  detailPrice: { fontSize: 20, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary },

  // AI Copilot
  aiCard: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.accent },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  aiTitle: { fontSize: 13, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text, flex: 1, letterSpacing: 0.8 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
  riskText: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700' },
  aiDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(0,119,182,0.06)', borderRadius: 6 },
  aiDisclaimerText: { fontSize: 11, fontFamily: typography.fontFamily.regular, color: colors.textMuted, fontStyle: 'italic' },
  aiSummarySection: { marginBottom: spacing.sm },
  aiSummary: { fontSize: 15, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 24 },
  aiBlock: {},
  aiBlockSpaced: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,119,182,0.08)' },
  aiBlockHeader: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary, letterSpacing: 0.8, marginBottom: 4 },
  aiBlockContent: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 22 },
  aiBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4, paddingLeft: 2 },
  aiBulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
  aiBulletText: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 22 },
  aiTruncatedHint: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  aiSummaryActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,119,182,0.06)' },
  aiSummaryActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10 },
  aiSummaryActionText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  urgencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  urgencyText: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },

  // Images
  imageScroll: { marginTop: 4 },
  img: { width: 160, height: 200, borderRadius: 14 },
  thumbContainer: { marginRight: 10, position: 'relative' },
  zoomBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 5, alignItems: 'center', justifyContent: 'center' },
  zoomHint: { fontSize: 10, color: colors.textMuted, fontFamily: typography.fontFamily.regular },
  imgCounter: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  imgCounterText: { fontSize: 10, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: '#fff' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center', alignItems: 'center' },
  modalImageWrapper: { flex: 1, width: '100%', alignSelf: 'stretch' },
  modalImageFull: { flex: 1, width: '100%', minHeight: 300 },
  modalCloseButton: { position: 'absolute', top: Platform.OS === 'web' ? 20 : 60, right: spacing.md, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 25, padding: 10, width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },

  // Medications/Exams – card style
  medCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  medCardBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  medIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  medIndexText: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary },
  medCardText: { fontSize: 14, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.text, flex: 1, lineHeight: 20 },

  // Kept for consultation AI suggestions
  medItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  medIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  medText: { fontSize: 14, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.text, flex: 1 },

  // Symptoms – quote block
  symptomsBlock: { borderLeftWidth: 3, borderLeftColor: colors.warning, paddingLeft: 12, paddingVertical: 4, backgroundColor: colors.warningLight + '40', borderRadius: 4 },
  symptomsText: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },

  // Anamnesis fields (post-consultation view)
  anaField: { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  anaLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  anaLabel: { fontSize: 10, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  anaValue: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 21 },
  redFlagBlock: { marginTop: 8, padding: 10, backgroundColor: '#1C0A0A', borderRadius: 8, borderWidth: 1, borderColor: '#7F1D1D' },
  redFlagItem: { paddingVertical: 4 },
  redFlagText: { fontSize: 13, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: '#FCA5A5', lineHeight: 20 },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  suggestionItemDanger: { backgroundColor: '#1C0A0A', borderRadius: 6, paddingHorizontal: 8, borderBottomWidth: 0, marginBottom: 4 },
  suggestionText: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 21 },
  medChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  medChip: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#064E3B', borderRadius: 20 },
  medChipText: { fontSize: 12, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: '#6EE7B7' },

  // Queue hint
  queueHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: pad, marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: borderRadius.card },
  queueHintText: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },

  // Actions
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderRadius: borderRadius.md, padding: spacing.md },
  pdfBtnText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },

  actions: { marginHorizontal: pad, marginTop: doctorDS.sectionGap, gap: spacing.sm },
  actionBtnFull: { width: '100%' },
  primaryBtnFlex: { flex: 1 },

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
});
