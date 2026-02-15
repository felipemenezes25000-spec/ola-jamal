import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { StatusBadge } from '../../components/StatusBadge';
import { Loading } from '../../components/Loading';
import { fetchRequestById, approveRequest, rejectRequest, signRequest, generatePdf, assignToQueue, acceptConsultation, reanalyzeAsDoctor } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function DoctorRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  useEffect(() => { load(); }, [id]);
  const load = async () => { try { if (id) setRequest(await fetchRequestById(id)); } catch {} finally { setLoading(false); } };

  const handleApprove = async () => {
    if (!request) return;
    setActionLoading('approve');
    try {
      await approveRequest(request.id);
      Alert.alert('Aprovado', 'Solicitação aprovada com sucesso.');
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setActionLoading(''); }
  };

  const handleReject = async () => {
    if (!request || !rejectReason) { Alert.alert('Atenção', 'Informe o motivo'); return; }
    setActionLoading('reject');
    try {
      await rejectRequest(request.id, rejectReason);
      Alert.alert('Rejeitado', 'Solicitação rejeitada.');
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setActionLoading(''); setShowReject(false); }
  };

  const handleSign = async () => {
    if (!request) return;
    setActionLoading('sign');
    try {
      // Generate PDF first if prescription
      if (request.requestType === 'prescription') {
        try { await generatePdf(request.id); } catch {}
      }
      await signRequest(request.id);
      Alert.alert('Assinado', 'Documento assinado digitalmente.');
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setActionLoading(''); }
  };

  const handleAssign = async () => {
    if (!request) return;
    setActionLoading('assign');
    try { await assignToQueue(request.id); Alert.alert('Sucesso', 'Solicitação atribuída.'); load(); }
    catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setActionLoading(''); }
  };

  if (loading) return <SafeAreaView style={styles.container}><Loading color={colors.primary} /></SafeAreaView>;
  if (!request) return <SafeAreaView style={styles.container}><Text style={styles.err}>Não encontrado</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.primaryDark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Revisar Solicitação</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Patient info */}
        <Card style={styles.card}>
          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}><Ionicons name="person" size={20} color={colors.white} /></View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{request.patientName || 'Paciente'}</Text>
              <Text style={styles.patientMeta}>{request.requestType === 'prescription' ? 'Receita' : request.requestType === 'exam' ? 'Exame' : 'Consulta'}{request.prescriptionType ? ` • ${request.prescriptionType}` : ''}</Text>
            </View>
            <StatusBadge status={request.status} size="sm" />
          </View>
        </Card>

        {/* AI Summary */}
        {request.aiSummaryForDoctor && (
          <Card style={[styles.card, { backgroundColor: '#FFF7ED' }]}>
            <View style={styles.aiRow}><Ionicons name="sparkles" size={18} color={colors.secondary} /><Text style={styles.aiTitle}>Resumo da IA</Text></View>
            <Text style={styles.aiText}>{request.aiSummaryForDoctor}</Text>
            {request.aiRiskLevel && <View style={styles.aiMeta}>
              <Text style={styles.aiMetaText}>Risco: {request.aiRiskLevel}</Text>
              <Text style={styles.aiMetaText}>Urgência: {request.aiUrgency || 'Normal'}</Text>
            </View>}
          </Card>
        )}

        {/* Reanalisar IA - quando não há resumo ou quando falhou */}
        {request.doctorId && (request.requestType === 'prescription' || request.requestType === 'exam') &&
          ((request.requestType === 'prescription' && request.prescriptionImages?.length) || (request.requestType === 'exam' && (request.examImages?.length || request.exams?.length || request.symptoms))) && (
          <Button
            title={request.aiSummaryForDoctor ? 'Reanalisar com IA' : 'Analisar com IA'}
            variant="outline"
            size="sm"
            onPress={async () => {
              setActionLoading('reanalyze');
              try {
                await reanalyzeAsDoctor(request.id);
                load();
              } catch (e: any) { Alert.alert('Erro', e.message); }
              finally { setActionLoading(''); }
            }}
            loading={actionLoading === 'reanalyze'}
            icon={<Ionicons name="sparkles" size={18} color={colors.secondary} />}
            style={{ marginBottom: spacing.md }}
          />
        )}

        {/* Prescription images */}
        {request.prescriptionImages && request.prescriptionImages.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>Imagens da Receita</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {request.prescriptionImages.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={styles.previewImg} resizeMode="cover" />
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Medications */}
        {request.medications && request.medications.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>Medicamentos</Text>
            {(request.medications as string[]).map((med, i) => (
              <View key={i} style={styles.medItem}>
                <Ionicons name="medical" size={16} color={colors.primary} />
                <Text style={styles.medText}>{med}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Exams */}
        {request.exams && request.exams.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>Exames Solicitados</Text>
            {request.exams.map((exam, i) => (
              <View key={i} style={styles.medItem}>
                <Ionicons name="flask" size={16} color={colors.primary} />
                <Text style={styles.medText}>{exam}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Symptoms */}
        {request.symptoms && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>Sintomas</Text>
            <Text style={styles.symptomsText}>{request.symptoms}</Text>
          </Card>
        )}

        {/* Reject form */}
        {showReject && (
          <Card style={[styles.card, { backgroundColor: colors.errorLight }]}>
            <Input label="Motivo da rejeição" placeholder="Explique por que está rejeitando..." value={rejectReason} onChangeText={setRejectReason} multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} />
            <View style={styles.rejectBtns}>
              <Button title="Cancelar" variant="ghost" size="sm" onPress={() => setShowReject(false)} />
              <Button title="Confirmar Rejeição" variant="danger" size="sm" onPress={handleReject} loading={actionLoading === 'reject'} />
            </View>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {!request.doctorId && ['submitted', 'paid'].includes(request.status) && (
            <Button title="Aceitar na Fila" onPress={handleAssign} loading={actionLoading === 'assign'} fullWidth icon={<Ionicons name="add-circle" size={20} color={colors.white} />} />
          )}
          {['submitted', 'paid', 'in_review'].includes(request.status) && request.doctorId && (
            <>
              <Button title="Aprovar" onPress={handleApprove} loading={actionLoading === 'approve'} fullWidth icon={<Ionicons name="checkmark-circle" size={20} color={colors.white} />} />
              <Button title="Rejeitar" variant="outline" onPress={() => setShowReject(true)} fullWidth style={{ marginTop: spacing.sm, borderColor: colors.error }} icon={<Ionicons name="close-circle" size={20} color={colors.error} />} />
            </>
          )}
          {['approved', 'approved_pending_payment', 'paid'].includes(request.status) && request.doctorId && (
            <Button title="Assinar Digitalmente" onPress={handleSign} loading={actionLoading === 'sign'} fullWidth style={{ marginTop: spacing.sm }} icon={<Ionicons name="create" size={20} color={colors.white} />} />
          )}
          {request.requestType === 'consultation' && ['searching_doctor'].includes(request.status) && (
            <Button title="Aceitar Consulta" onPress={async () => {
              setActionLoading('accept');
              try {
                const result = await acceptConsultation(request.id);
                Alert.alert('Sucesso', 'Consulta aceita. Sala de vídeo criada.', [
                  { text: 'Entrar na videochamada', onPress: () => router.push(`/video/${request.id}`) },
                  { text: 'OK', onPress: () => load() },
                ]);
                load();
              } catch (e: any) { Alert.alert('Erro', e.message); }
              finally { setActionLoading(''); }
            }} loading={actionLoading === 'accept'} fullWidth style={{ marginTop: spacing.sm }} icon={<Ionicons name="videocam" size={20} color={colors.white} />} />
          )}
          {request.requestType === 'consultation' && request.doctorId && ['consultation_ready', 'in_consultation'].includes(request.status) && (
            <Button title="Entrar na Videochamada" onPress={() => router.push(`/video/${request.id}`)} fullWidth style={{ marginTop: spacing.sm }} icon={<Ionicons name="videocam" size={20} color={colors.white} />} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  err: { ...typography.body, color: colors.error, textAlign: 'center', marginTop: 100 },
  card: { marginBottom: spacing.md },
  patientRow: { flexDirection: 'row', alignItems: 'center' },
  patientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  patientInfo: { flex: 1 },
  patientName: { ...typography.bodySemiBold, color: colors.gray800 },
  patientMeta: { ...typography.caption, color: colors.gray500 },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  aiTitle: { ...typography.bodySmallMedium, color: colors.secondaryDark },
  aiText: { ...typography.bodySmall, color: colors.gray700 },
  aiMeta: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  aiMetaText: { ...typography.caption, color: colors.gray500 },
  sectionLabel: { ...typography.bodySemiBold, color: colors.primaryDarker, marginBottom: spacing.sm },
  imagesScroll: { flexDirection: 'row' },
  previewImg: { width: 120, height: 160, borderRadius: borderRadius.md, marginRight: spacing.sm },
  medItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  medText: { ...typography.bodySmall, color: colors.gray700 },
  symptomsText: { ...typography.bodySmall, color: colors.gray700 },
  rejectBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  actions: { marginTop: spacing.md },
});
