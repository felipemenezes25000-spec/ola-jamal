import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { StatusBadge, getStatusLabel } from '../../components/StatusBadge';
import { Loading } from '../../components/Loading';
import { fetchRequestById, createPayment, fetchPaymentByRequest } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const TIMELINE_STEPS = [
  { key: 'submitted', label: 'Enviado', icon: 'paper-plane' },
  { key: 'analyzing', label: 'IA Analisando', icon: 'sparkles' },
  { key: 'paid', label: 'Pago', icon: 'card' },
  { key: 'in_review', label: 'Médico Revisando', icon: 'eye' },
  { key: 'signed', label: 'Assinado', icon: 'create' },
  { key: 'delivered', label: 'Entregue', icon: 'checkmark-done' },
];

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [requestId]);

  const load = async () => {
    if (!requestId) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchRequestById(requestId);
      setRequest(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handlePay = async () => {
    if (!request) return;
    try {
      // Check if payment already exists
      let payment;
      try { payment = await fetchPaymentByRequest(request.id); } catch {}
      if (!payment) {
        payment = await createPayment({ requestId: request.id, paymentMethod: 'pix' });
      }
      router.push(`/payment/${payment.id}`);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao iniciar pagamento');
    }
  };

  const handleDownload = () => {
    if (request?.signedDocumentUrl) {
      Linking.openURL(request.signedDocumentUrl);
    }
  };

  if (loading) return <SafeAreaView style={styles.container}><Loading color={colors.primary} message="Carregando..." /></SafeAreaView>;
  if (!request) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.primaryDark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.errorContainer}>
        <Ionicons name="document-text-outline" size={48} color={colors.gray400} style={styles.errorIcon} />
        <Text style={styles.errorTitle}>Solicitação não encontrada</Text>
        <Text style={styles.errorText}>A solicitação não foi encontrada ou você não tem acesso a ela.</Text>
        <Button title="Voltar" onPress={() => router.back()} variant="outline" style={styles.errorButton} />
      </View>
    </SafeAreaView>
  );

  const statusOrder = ['submitted', 'paid', 'in_review', 'approved', 'signed', 'delivered', 'completed'];
  const currentIdx = statusOrder.indexOf(request.status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.primaryDark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.typeLabel}>{request.requestType === 'prescription' ? 'Receita' : request.requestType === 'exam' ? 'Exame' : 'Consulta'}</Text>
              {request.prescriptionType && <Text style={styles.subType}>Tipo: {request.prescriptionType}</Text>}
            </View>
            <StatusBadge status={request.status} />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>Criado em {new Date(request.createdAt).toLocaleDateString('pt-BR')}</Text>
            {request.price != null && request.price > 0 && <Text style={styles.price}>R$ {request.price.toFixed(2)}</Text>}
          </View>
        </Card>

        {/* AI Analysis */}
        {request.aiSummaryForDoctor && (
          <Card style={styles.aiCard}>
            <View style={styles.aiHeader}><Ionicons name="sparkles" size={18} color={colors.secondary} /><Text style={styles.aiTitle}>Análise da IA</Text></View>
            <Text style={styles.aiText}>{request.aiSummaryForDoctor}</Text>
            {request.aiRiskLevel && <Text style={styles.aiMeta}>Risco: {request.aiRiskLevel} | Urgência: {request.aiUrgency || 'Normal'}</Text>}
          </Card>
        )}

        {/* Doctor info */}
        {request.doctorName && (
          <Card style={styles.doctorCard}>
            <View style={styles.doctorRow}>
              <View style={styles.doctorAvatar}><Ionicons name="person" size={24} color={colors.white} /></View>
              <View>
                <Text style={styles.doctorName}>{request.doctorName}</Text>
                <Text style={styles.doctorDetail}>Médico responsável</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Timeline */}
        <Card style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Progresso</Text>
          {TIMELINE_STEPS.map((step, idx) => {
            const isCompleted = currentIdx >= idx;
            const isCurrent = currentIdx === idx;
            return (
              <View key={step.key} style={styles.timelineItem}>
                <View style={styles.timelineLine}>
                  <View style={[styles.timelineDot, isCompleted && styles.timelineDotActive, isCurrent && styles.timelineDotCurrent]} >
                    <Ionicons name={step.icon as any} size={14} color={isCompleted ? colors.white : colors.gray400} />
                  </View>
                  {idx < TIMELINE_STEPS.length - 1 && <View style={[styles.timelineConnector, isCompleted && styles.connectorActive]} />}
                </View>
                <Text style={[styles.timelineLabel, isCompleted && styles.timelineLabelActive]}>{step.label}</Text>
              </View>
            );
          })}
        </Card>

        {/* Rejection reason */}
        {request.rejectionReason && (
          <Card style={styles.rejectCard}>
            <Ionicons name="close-circle" size={20} color={colors.error} />
            <Text style={styles.rejectText}>Motivo: {request.rejectionReason}</Text>
          </Card>
        )}

        {/* Actions */}
        {['pending_payment', 'approved_pending_payment', 'approved'].includes(request.status) && (
          <Button title="Realizar Pagamento" onPress={handlePay} fullWidth icon={<Ionicons name="card" size={20} color={colors.white} />} />
        )}
        {request.signedDocumentUrl && (
          <Button title="Baixar Documento Assinado" onPress={handleDownload} variant="outline" fullWidth style={{ marginTop: spacing.sm }} icon={<Ionicons name="download" size={20} color={colors.primary} />} />
        )}
        {request.status === 'consultation_ready' && (
          <Button title="Entrar na Consulta" onPress={() => router.push(`/video/${request.id}`)} fullWidth style={{ marginTop: spacing.sm }} icon={<Ionicons name="videocam" size={20} color={colors.white} />} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  errorIcon: { marginBottom: spacing.md },
  errorTitle: { ...typography.h4, color: colors.gray800, textAlign: 'center', marginBottom: spacing.sm },
  errorText: { ...typography.bodySmall, color: colors.gray500, textAlign: 'center', marginBottom: spacing.xl },
  errorButton: { minWidth: 120 },
  statusCard: { marginBottom: spacing.md },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  typeLabel: { ...typography.h4, color: colors.gray800 },
  subType: { ...typography.caption, color: colors.gray500, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { ...typography.caption, color: colors.gray400 },
  price: { ...typography.bodySemiBold, color: colors.primary },
  aiCard: { marginBottom: spacing.md, backgroundColor: '#FFF7ED' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  aiTitle: { ...typography.bodySmallMedium, color: colors.secondaryDark },
  aiText: { ...typography.bodySmall, color: colors.gray700 },
  aiMeta: { ...typography.caption, color: colors.gray500, marginTop: spacing.xs },
  doctorCard: { marginBottom: spacing.md },
  doctorRow: { flexDirection: 'row', alignItems: 'center' },
  doctorAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  doctorName: { ...typography.bodySemiBold, color: colors.gray800 },
  doctorDetail: { ...typography.caption, color: colors.gray500 },
  timelineCard: { marginBottom: spacing.md },
  timelineTitle: { ...typography.bodySemiBold, color: colors.primaryDarker, marginBottom: spacing.md },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  timelineLine: { alignItems: 'center', marginRight: spacing.md, width: 28 },
  timelineDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gray200, justifyContent: 'center', alignItems: 'center' },
  timelineDotActive: { backgroundColor: colors.success },
  timelineDotCurrent: { backgroundColor: colors.primary },
  timelineConnector: { width: 2, height: 20, backgroundColor: colors.gray200 },
  connectorActive: { backgroundColor: colors.success },
  timelineLabel: { ...typography.bodySmall, color: colors.gray400, paddingTop: 4 },
  timelineLabelActive: { color: colors.gray800, fontWeight: '500' },
  rejectCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, backgroundColor: colors.errorLight },
  rejectText: { flex: 1, ...typography.bodySmall, color: colors.error },
});
