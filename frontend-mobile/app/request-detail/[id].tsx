import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { fetchRequestById, createPayment, fetchPaymentByRequest, markRequestDelivered, cancelRequest } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { StatusBadge } from '../../components/StatusBadge';
import StatusTracker from '../../components/StatusTracker';

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

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    if (!requestId) { setLoading(false); return; }
    try {
      const data = await fetchRequestById(requestId);
      setRequest(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [requestId]);
  useFocusEffect(useCallback(() => { if (requestId) load(); }, [requestId]));

  const handlePay = async () => {
    if (!request || actionLoading) return;
    setActionLoading(true);
    try {
      let payment;
      try { payment = await fetchPaymentByRequest(request.id); } catch {}
      if (!payment) {
        payment = await createPayment({ requestId: request.id, paymentMethod: 'pix' });
      }
      router.push(`/payment/${payment.id}`);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao iniciar pagamento');
    } finally {
      setActionLoading(false);
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
    if (!request?.signedDocumentUrl) return;
    try {
      await markAsDeliveredIfSigned();
      if (Platform.OS === 'web') {
        window?.open?.(request.signedDocumentUrl, '_blank');
        return;
      }
      await Linking.openURL(request.signedDocumentUrl);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível baixar o documento');
    }
  };

  const handleViewDocument = async () => {
    if (!request?.signedDocumentUrl) return;
    try {
      await markAsDeliveredIfSigned();
      await WebBrowser.openBrowserAsync(request.signedDocumentUrl);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível abrir o documento.');
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
            } catch (e: any) {
              Alert.alert('Erro', e?.message || 'Não foi possível cancelar.');
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

  if (!request) {
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

  const canPay = ['pending_payment', 'approved_pending_payment', 'approved', 'consultation_ready'].includes(request.status);
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
          {request.price != null && request.price > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Valor</Text>
              <Text style={[styles.detailValue, { color: colors.success, fontWeight: '700' }]}>
                R$ {request.price.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Criado em</Text>
            <Text style={styles.detailValue}>
              {new Date(request.createdAt).toLocaleDateString('pt-BR')} {new Date(request.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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

        {/* Exams */}
        {request.exams && request.exams.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="flask" size={20} color="#8B5CF6" />
              <Text style={styles.cardTitle}>Exames</Text>
            </View>
            {request.exams.map((exam, i) => (
              <View key={i} style={styles.medItem}>
                <View style={styles.medIcon}>
                  <Ionicons name="ellipse" size={8} color="#8B5CF6" />
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
            <Text style={styles.symptomsText}>{request.symptoms}</Text>
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
            <Text style={styles.aiSummary}>{request.aiSummaryForDoctor}</Text>
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
            <TouchableOpacity style={styles.primaryBtn} onPress={handlePay} disabled={actionLoading} activeOpacity={0.8}>
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="qr-code" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Pagar</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {canDownload && (
            <>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleDownload} activeOpacity={0.8}>
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Baixar Receita</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={handleViewDocument} activeOpacity={0.8}>
                <Ionicons name="eye" size={20} color={colors.primary} />
                <Text style={styles.outlineBtnText}>Visualizar</Text>
              </TouchableOpacity>
            </>
          )}

          {canJoinVideo && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.success }]} onPress={handleEnterConsultation} activeOpacity={0.8}>
              <Ionicons name="videocam" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Entrar na Consulta</Text>
            </TouchableOpacity>
          )}

          {canCancel && (
            <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.textMuted }]} onPress={handleCancel} disabled={actionLoading} activeOpacity={0.8}>
              <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.outlineBtnText, { color: colors.textMuted }]}>Cancelar pedido</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 3 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
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
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  outlineBtn: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  outlineBtnText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  errorTitle: { fontSize: 18, fontWeight: '600', color: colors.textSecondary },
  errorBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  errorBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
