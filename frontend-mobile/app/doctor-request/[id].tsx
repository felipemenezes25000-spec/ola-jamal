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
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import {
  getRequestById,
  approveRequest,
  rejectRequest,
  signRequest,
  acceptConsultation,
} from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import StatusTracker from '../../components/StatusTracker';
import { StatusBadge } from '../../components/StatusBadge';

const TYPE_LABELS: Record<string, string> = { prescription: 'Receita', exam: 'Exame', consultation: 'Consulta' };
const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: '#D1FAE5', text: '#059669' },
  medium: { bg: '#FEF3C7', text: '#D97706' },
  high: { bg: '#FEE2E2', text: '#DC2626' },
};

export default function DoctorRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [showSignForm, setShowSignForm] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try { setRequest(await getRequestById(id)); }
    catch { console.error('Error loading request'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = () => {
    Alert.alert('Aprovar', 'Confirma a aprovação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprovar', onPress: async () => {
        setActionLoading(true);
        try { await approveRequest(id!); loadData(); }
        catch (e: any) { Alert.alert('Erro', e?.message || 'Falha ao aprovar.'); }
        finally { setActionLoading(false); }
      }},
    ]);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { Alert.alert('Obrigatório', 'Informe o motivo.'); return; }
    setActionLoading(true);
    try { await rejectRequest(id!, rejectionReason.trim()); loadData(); setShowRejectForm(false); }
    catch (e: any) { Alert.alert('Erro', e?.message || 'Falha.'); }
    finally { setActionLoading(false); }
  };

  const handleSign = async () => {
    if (!certPassword.trim()) { Alert.alert('Obrigatório', 'Digite a senha do certificado.'); return; }
    setActionLoading(true);
    try {
      await signRequest(id!, { pfxPassword: certPassword });
      loadData(); setShowSignForm(false); setCertPassword('');
      Alert.alert('Sucesso!', 'Documento assinado digitalmente.');
    } catch (e: any) { Alert.alert('Erro', e?.message || 'Senha incorreta ou erro na assinatura.'); }
    finally { setActionLoading(false); }
  };

  const handleAcceptConsultation = async () => {
    setActionLoading(true);
    try { await acceptConsultation(id!); loadData(); }
    catch (e: any) { Alert.alert('Erro', e?.message || 'Falha.'); }
    finally { setActionLoading(false); }
  };

  const fmt = (d: string) => { const dt = new Date(d); return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; };

  const canApprove = request && request.status === 'in_review' && request.requestType !== 'consultation';
  const canReject = request && request.status === 'in_review';
  const canSign = request && request.status === 'paid' && request.requestType !== 'consultation';
  const canAccept = request && request.status === 'searching_doctor' && request.requestType === 'consultation';
  const canVideo = request && ['paid', 'in_consultation'].includes(request.status) && request.requestType === 'consultation';

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!request) return <View style={s.center}><Text style={{ color: colors.textSecondary }}>Pedido não encontrado</Text></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={24} color={colors.primary} /></TouchableOpacity>
        <Text style={s.title}>{TYPE_LABELS[request.requestType] || 'Pedido'}</Text>
        <StatusBadge status={request.status} />
      </View>

      <View style={s.card}><StatusTracker currentStatus={request.status} requestType={request.requestType} /></View>

      {/* Patient */}
      <View style={s.card}>
        <Text style={s.section}>PACIENTE</Text>
        <Row k="Nome" v={request.patientName || 'N/A'} />
        <View style={s.row}><Text style={s.rk}>ID</Text><View style={s.idBadge}><Text style={s.idText}>{request.id.slice(0, 8)}</Text></View></View>
        <Row k="Criado em" v={fmt(request.createdAt)} />
      </View>

      {/* Details */}
      <View style={s.card}>
        <Text style={s.section}>DETALHES</Text>
        <Row k="Tipo" v={TYPE_LABELS[request.requestType]} />
        {request.prescriptionType && <Row k="Modalidade" v={request.prescriptionType === 'simples' ? 'Simples' : request.prescriptionType === 'controlado' ? 'Controlada' : 'Azul'} warn={request.prescriptionType === 'controlado'} />}
        {request.price != null && <Row k="Valor" v={`R$ ${request.price.toFixed(2).replace('.', ',')}`} green />}
      </View>

      {/* AI */}
      {request.aiSummaryForDoctor && (
        <View style={[s.card, s.aiCard]}>
          <View style={s.aiH}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={s.aiT}>Análise IA</Text>
            {request.aiRiskLevel && (
              <View style={[s.riskB, { backgroundColor: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.bg || '#E2E8F0' }]}>
                <Text style={[s.riskT, { color: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text }]}>{request.aiRiskLevel.toUpperCase()} RISK</Text>
              </View>
            )}
          </View>
          <Text style={s.aiS}>{request.aiSummaryForDoctor}</Text>
          {request.aiUrgency && <View style={s.urgR}><Ionicons name="time" size={14} color={colors.textSecondary} /><Text style={s.urgT}>Urgência: {request.aiUrgency}</Text></View>}
        </View>
      )}

      {/* Images */}
      {request.prescriptionImages && request.prescriptionImages.length > 0 && (
        <View style={s.card}>
          <Text style={s.section}>IMAGENS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {request.prescriptionImages.map((img, i) => <Image key={i} source={{ uri: img }} style={s.img} resizeMode="cover" />)}
          </ScrollView>
        </View>
      )}

      {/* Meds */}
      {request.medications && request.medications.length > 0 && (
        <View style={s.card}>
          <Text style={s.section}>MEDICAMENTOS</Text>
          {request.medications.map((m, i) => <MedItem key={i} text={m} color={colors.primary} bg={colors.primaryLight} />)}
        </View>
      )}

      {/* Exams */}
      {request.exams && request.exams.length > 0 && (
        <View style={s.card}>
          <Text style={s.section}>EXAMES</Text>
          {request.exams.map((e, i) => <MedItem key={i} text={e} color="#7C3AED" bg="#EDE9FE" />)}
        </View>
      )}

      {/* Symptoms */}
      {request.symptoms && <View style={s.card}><Text style={s.section}>SINTOMAS</Text><Text style={s.sym}>{request.symptoms}</Text></View>}

      {/* Sign Form */}
      {showSignForm && (
        <View style={s.card}>
          <Text style={s.section}>ASSINATURA DIGITAL</Text>
          <Text style={s.formDesc}>Digite a senha do certificado A1:</Text>
          <TextInput style={s.formInput} placeholder="Senha" secureTextEntry value={certPassword} onChangeText={setCertPassword} placeholderTextColor={colors.textMuted} />
          <View style={s.formBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowSignForm(false); setCertPassword(''); }}><Text style={s.cancelT}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={s.signBtn} onPress={handleSign} disabled={actionLoading}>{actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Assinar</Text>}</TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reject Form */}
      {showRejectForm && (
        <View style={s.card}>
          <Text style={s.section}>REJEIÇÃO</Text>
          <TextInput style={s.formArea} placeholder="Motivo..." value={rejectionReason} onChangeText={setRejectionReason} multiline textAlignVertical="top" placeholderTextColor={colors.textMuted} />
          <View style={s.formBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowRejectForm(false)}><Text style={s.cancelT}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={s.rejBtn} onPress={handleReject} disabled={actionLoading}>{actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Rejeitar</Text>}</TouchableOpacity>
          </View>
        </View>
      )}

      {/* Actions */}
      {!showSignForm && !showRejectForm && (
        <View style={s.actions}>
          {canAccept && <Btn bg={colors.secondary} icon="checkmark" text="Aceitar Consulta" onPress={handleAcceptConsultation} loading={actionLoading} />}
          {canApprove && <Btn bg={colors.primary} icon="checkmark-circle" text="Aprovar" onPress={handleApprove} loading={actionLoading} />}
          {canSign && <Btn bg="#8B5CF6" icon="create" text="Assinar Digitalmente" onPress={() => setShowSignForm(true)} />}
          {canVideo && <Btn bg={colors.secondary} icon="videocam" text="Iniciar Consulta" onPress={() => router.push(`/video/${request.id}`)} />}
          {canReject && (
            <TouchableOpacity style={s.rejOutline} onPress={() => setShowRejectForm(true)}>
              <Ionicons name="close-circle-outline" size={20} color={colors.error} />
              <Text style={s.rejOutText}>Rejeitar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Row({ k, v, green, warn }: { k: string; v: string; green?: boolean; warn?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rk}>{k}</Text>
      {warn ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
          <Ionicons name="warning" size={12} color="#D97706" /><Text style={{ fontSize: 13, fontWeight: '600', color: '#D97706' }}>{v}</Text>
        </View>
      ) : <Text style={[s.rv, green && { color: colors.success, fontWeight: '700' }]}>{v}</Text>}
    </View>
  );
}

function MedItem({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="medical" size={14} color={color} />
      </View>
      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>{text}</Text>
    </View>
  );
}

function Btn({ bg, icon, text, onPress, loading }: { bg: string; icon: string; text: string; onPress: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity style={[s.pBtn, { backgroundColor: bg }]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name={icon as any} size={20} color="#fff" /><Text style={s.btnT}>{text}</Text></>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: borderRadius.md, padding: spacing.md, ...shadows.card },
  section: { fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.5, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rk: { fontSize: 14, color: colors.textSecondary },
  rv: { fontSize: 14, fontWeight: '500', color: colors.text },
  idBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6 },
  idText: { fontSize: 12, fontWeight: '600', color: colors.primary, fontFamily: 'monospace' },
  aiCard: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  aiH: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  aiT: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
  riskB: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6 },
  riskT: { fontSize: 11, fontWeight: '700' },
  aiS: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.sm },
  urgR: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  urgT: { fontSize: 13, color: colors.textSecondary },
  img: { width: 180, height: 180, borderRadius: borderRadius.sm, marginRight: spacing.sm },
  sym: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  actions: { marginHorizontal: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  pBtn: { flexDirection: 'row', padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 52 },
  btnT: { fontSize: 16, fontWeight: '700', color: '#fff' },
  rejOutline: { flexDirection: 'row', padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.error },
  rejOutText: { fontSize: 15, fontWeight: '600', color: colors.error },
  formDesc: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  formInput: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: spacing.md, height: 44, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border },
  formArea: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 100, borderWidth: 1, borderColor: colors.border },
  formBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cancelT: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  signBtn: { flex: 1, backgroundColor: '#8B5CF6', padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  rejBtn: { flex: 1, backgroundColor: colors.error, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
});
