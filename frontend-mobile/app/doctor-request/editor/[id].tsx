import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography, doctorDS } from '../../../lib/themeDoctor';
import {
  getRequestById,
  signRequest,
  getPreviewPdf,
  updatePrescriptionContent,
  validatePrescription,
} from '../../../lib/api';
import { RequestResponseDto, PrescriptionKind } from '../../../types/database';
import { searchCid } from '../../../lib/cid-medications';
import { ZoomablePdfView } from '../../../components/ZoomablePdfView';
import { DoctorHeader } from '../../../components/ui/DoctorHeader';
import { DoctorCard } from '../../../components/ui/DoctorCard';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { SkeletonList, SkeletonLoader } from '../../../components/ui/SkeletonLoader';
import { showToast } from '../../../components/ui/Toast';

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: colors.successLight, text: colors.success },
  medium: { bg: colors.warningLight, text: '#D97706' },
  high: { bg: colors.errorLight, text: colors.destructive },
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

function parseAiMedications(aiExtractedJson: string | null): string[] {
  if (!aiExtractedJson) return [];
  try {
    const obj = JSON.parse(aiExtractedJson);
    const arr = obj?.medications;
    if (Array.isArray(arr)) {
      return arr.map((m: any) => String(m || '').trim()).filter(Boolean);
    }
  } catch { }
  return [];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function PrescriptionEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = (Array.isArray(id) ? id[0] : id) ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<string[]>([]);
  const [prescriptionKind, setPrescriptionKind] = useState<PrescriptionKind>('simple');
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(new Set());
  const [cidQuery, setCidQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [showSignForm, setShowSignForm] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfBlobUrlRef = useRef<string | null>(null);

  const loadRequest = useCallback(async () => {
    if (!requestId) return;
    try {
      const data = await getRequestById(requestId);
      setRequest(data);
      const meds = data.medications?.filter(Boolean) ?? [];
      setMedications(meds.length > 0 ? meds : []);
      setNotes(data.notes ?? '');
      setPrescriptionKind((data.prescriptionKind as PrescriptionKind) || 'simple');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  const loadPdfPreview = useCallback(async () => {
    if (!requestId) return;
    setPdfLoading(true);
    try {
      const blob = await getPreviewPdf(requestId);
      if (Platform.OS === 'web') {
        if (pdfBlobUrlRef.current) {
          URL.revokeObjectURL(pdfBlobUrlRef.current);
          pdfBlobUrlRef.current = null;
        }
        const url = URL.createObjectURL(blob);
        pdfBlobUrlRef.current = url;
        setPdfUri(url);
      } else {
        const base64 = await blobToBase64(blob);
        setPdfUri(`data:application/pdf;base64,${base64}`);
      }
    } catch (e: any) {
      setPdfUri(null);
      console.warn('Erro ao carregar preview PDF:', e?.message);
    } finally {
      setPdfLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  useEffect(() => {
    if (request?.requestType === 'prescription') {
      loadPdfPreview();
    }
    return () => {
      if (Platform.OS === 'web' && pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
    };
  }, [request?.id, request?.requestType, loadPdfPreview]);

  const handleSave = async () => {
    const meds = medications.map((m) => m.trim()).filter(Boolean);
    if (meds.length === 0) {
      showToast({ message: 'Adicione ao menos um medicamento à receita.', type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await updatePrescriptionContent(requestId, {
        medications: meds,
        notes: notes.trim() || undefined,
        prescriptionKind,
      });
      await loadRequest();
      await loadPdfPreview();
      showToast({ message: 'Alterações salvas. Preview atualizado.', type: 'success' });
    } catch (e: any) {
      showToast({ message: e?.message || 'Falha ao salvar.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!certPassword.trim()) {
      showToast({ message: 'Digite a senha do certificado.', type: 'warning' });
      return;
    }
    setSigning(true);
    try {
      await updatePrescriptionContent(requestId, {
        medications: medications.map((m) => m.trim()).filter(Boolean),
        notes: notes.trim() || undefined,
        prescriptionKind,
      });
      const validation = await validatePrescription(requestId);
      if (!validation.valid) {
        const needsPatientProfile = (validation.missingFields ?? []).some(
          (f) => f.includes('paciente.sexo') || f.includes('paciente.data_nascimento') || f.includes('paciente.endereço')
        );
        const needsDoctorProfile = (validation.missingFields ?? []).some(
          (f) => f.includes('médico.endereço') || f.includes('médico.telefone')
        );
        const checklist = (validation.messages ?? []).join('\n• ');
        const action = needsPatientProfile
          ? 'O paciente precisa completar sexo, data de nascimento ou endereço no perfil.'
          : needsDoctorProfile
            ? 'Complete seu endereço e telefone profissional no perfil do médico.'
            : 'Corrija os campos indicados antes de assinar.';
        Alert.alert(
          'Receita incompleta',
          `${action}\n\n• ${checklist}`,
          [
            { text: 'OK' },
            ...(needsDoctorProfile
              ? [{ text: 'Ir ao meu perfil', onPress: () => router.push('/(doctor)/profile' as any) }]
              : []),
          ]
        );
        setSigning(false);
        return;
      }
      await signRequest(requestId, { pfxPassword: certPassword });
      setShowSignForm(false);
      setCertPassword('');
      showToast({ message: 'Documento assinado digitalmente!', type: 'success' });
      router.back();
    } catch (e: any) {
      if (e?.missingFields?.length || e?.messages?.length) {
        const checklist = (e.messages ?? [e.message]).join('\n• ');
        const needsDoctorProfile = (e.missingFields ?? []).some(
          (f: string) => f.includes('médico.endereço') || f.includes('médico.telefone')
        );
        Alert.alert(
          'Receita incompleta',
          `Verifique os campos obrigatórios:\n\n• ${checklist}`,
          needsDoctorProfile
            ? [
              { text: 'OK' },
              { text: 'Ir ao meu perfil', onPress: () => router.push('/(doctor)/profile' as any) },
            ]
            : [{ text: 'OK' }]
        );
      } else {
        showToast({ message: e?.message || 'Senha incorreta ou erro na assinatura.', type: 'error' });
      }
    } finally {
      setSigning(false);
    }
  };

  const suggestedFromAi = useMemo(() => {
    const fromAi = parseAiMedications(request?.aiExtractedJson ?? null);
    const accepted = new Set(medications);
    return fromAi.filter((m) => !accepted.has(m) && !rejectedSuggestions.has(m));
  }, [request?.aiExtractedJson, medications, rejectedSuggestions]);

  const cidResults = useMemo(() => searchCid(cidQuery), [cidQuery]);

  const acceptSuggestion = (med: string) => {
    setMedications((prev) => (prev.includes(med) ? prev : [...prev, med]));
  };
  const rejectSuggestion = (med: string) => {
    setRejectedSuggestions((prev) => new Set(prev).add(med));
  };
  const addFromCid = (med: string) => {
    setMedications((prev) => (prev.includes(med) ? prev : [...prev, med]));
  };
  const addCustom = () => setMedications((prev) => [...prev, '']);
  const removeMedication = (i: number) =>
    setMedications((prev) => prev.filter((_, idx) => idx !== i));
  const updateMedication = (i: number, value: string) =>
    setMedications((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });

  if (loading || !request) {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <DoctorHeader title="Carregando..." onBack={() => router.back()} />
        <View style={{ padding: spacing.md }}>
          <SkeletonLoader width="60%" height={20} style={{ marginBottom: 12 }} />
          <SkeletonList count={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (request.requestType !== 'prescription') {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <DoctorHeader title="Editor" onBack={() => router.back()} />
        <View style={st.center}>
          <Ionicons name="document-text-outline" size={56} color={colors.textMuted} />
          <Text style={{ color: colors.textSecondary, marginTop: spacing.sm, fontFamily: typography.fontFamily.regular }}>
            Editor disponível apenas para receitas.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const pdfViewHeight = Math.min(500, Dimensions.get('window').height - 180);

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <DoctorHeader title="Editar Receita" onBack={() => router.back()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={st.scroll}
          contentContainerStyle={st.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Prescription Kind */}
          <DoctorCard style={st.cardMargin}>
            <Text style={st.sectionTitle}>TIPO DE RECEITA</Text>
            <Text style={st.hint}>Selecione o modelo (CFM, RDC 471/2021, ANVISA/SNCR)</Text>
            <View style={st.kindRow}>
              {(['simple', 'antimicrobial', 'controlled_special'] as PrescriptionKind[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[st.kindOption, prescriptionKind === k && st.kindOptionActive]}
                  onPress={() => setPrescriptionKind(k)}
                  activeOpacity={0.7}
                >
                  <Text style={[st.kindOptionText, prescriptionKind === k && st.kindOptionTextActive]}>
                    {k === 'simple' ? 'Simples' : k === 'antimicrobial' ? 'Antimicrobiano' : 'Controle especial'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </DoctorCard>

          {/* PDF Preview */}
          <DoctorCard style={[st.cardMargin, st.pdfCard]}>
            <View style={st.pdfHeader}>
              <Ionicons name="document-text" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={st.pdfTitle}>Preview da Receita</Text>
                {prescriptionKind === 'antimicrobial' && (
                  <Text style={st.validityText}>Validade: 10 dias (RDC 471/2021)</Text>
                )}
              </View>
              <TouchableOpacity onPress={loadPdfPreview} disabled={pdfLoading} style={st.refreshBtn} activeOpacity={0.7}>
                <Ionicons name="refresh" size={18} color={colors.primary} />
                <Text style={st.refreshBtnText}>Atualizar</Text>
              </TouchableOpacity>
            </View>
            {pdfLoading ? (
              <View style={[st.pdfPlaceholder, { minHeight: pdfViewHeight }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={st.pdfPlaceholderText}>Gerando preview...</Text>
              </View>
            ) : pdfUri ? (
              <View style={[st.pdfContainer, { height: pdfViewHeight }]}>
                {Platform.OS === 'web' ? (
                  <View style={st.iframeWrapper}>
                    {/* @ts-ignore - iframe is valid on web */}
                    <iframe
                      src={pdfUri}
                      title="Preview da receita"
                      style={{
                        width: '100%',
                        height: pdfViewHeight,
                        border: 'none',
                        borderRadius: 8,
                        backgroundColor: colors.background,
                      }}
                    />
                  </View>
                ) : (
                  <ZoomablePdfView>
                    <WebView
                      source={{ uri: pdfUri }}
                      style={[st.webview, { height: pdfViewHeight }]}
                      scrollEnabled
                      originWhitelist={['*']}
                    />
                  </ZoomablePdfView>
                )}
              </View>
            ) : (
              <View style={[st.pdfPlaceholder, { minHeight: 160 }]}>
                <Ionicons name="document-outline" size={40} color={colors.textMuted} />
                <Text style={st.pdfPlaceholderText}>
                  Adicione medicamentos e salve para gerar o preview.
                </Text>
                <TouchableOpacity onPress={loadPdfPreview} style={st.retryBtn} activeOpacity={0.7}>
                  <Text style={st.retryBtnText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            )}
          </DoctorCard>

          {/* AI Analysis */}
          {request.aiSummaryForDoctor && (
            <DoctorCard style={[st.cardMargin, st.aiCard]}>
              <View style={st.aiHeader}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={st.aiTitle}>AI Copilot — apoio à prescrição</Text>
                {request.aiRiskLevel && (
                  <View style={[st.riskBadge, { backgroundColor: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.bg || colors.muted }]}>
                    <Text style={[st.riskText, { color: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text }]}>
                      {RISK_LABELS_PT[request.aiRiskLevel.toLowerCase()] || request.aiRiskLevel}
                    </Text>
                  </View>
                )}
              </View>
              {/* AI Disclaimer */}
              <View style={st.aiDisclaimer}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={st.aiDisclaimerText}>Conteúdo gerado automaticamente. Revise e confirme.</Text>
              </View>
              <Text style={st.aiSummary}>
                {String(request.aiSummaryForDoctor || '')
                  .split(/\n+/)
                  .map((p) => (p.trim() ? p.trim() : null))
                  .filter(Boolean)
                  .join('\n\n')}
              </Text>
              {request.aiUrgency && (
                <View style={st.urgencyRow}>
                  <Ionicons name="time" size={16} color={colors.textSecondary} />
                  <Text style={st.urgencyText}>Urgência: {URGENCY_LABELS_PT[request.aiUrgency.toLowerCase()] || request.aiUrgency}</Text>
                </View>
              )}
            </DoctorCard>
          )}

          {/* AI Suggestions */}
          {suggestedFromAi.length > 0 && (
            <DoctorCard style={st.cardMargin}>
              <Text style={st.sectionTitle}>SUGESTÕES DA IA</Text>
              <View style={st.aiDisclaimer}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={st.aiDisclaimerText}>Sugestões — decisão final do médico.</Text>
              </View>
              {suggestedFromAi.map((med, i) => (
                <View key={`sug-${i}`} style={st.suggestionRow}>
                  <Text style={st.suggestionText} numberOfLines={2}>{med}</Text>
                  <View style={st.plusMinusRow}>
                    <TouchableOpacity onPress={() => acceptSuggestion(med)} style={st.plusMinusBtn} hitSlop={8}>
                      <Ionicons name="add-circle" size={28} color={colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => rejectSuggestion(med)} style={st.plusMinusBtn} hitSlop={8}>
                      <Ionicons name="remove-circle" size={28} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
          </DoctorCard>
          )}

          {/* CID Search */}
          <DoctorCard style={st.cardMargin}>
            <Text style={st.sectionTitle}>BUSCAR POR CID</Text>
            <Text style={st.hint}>Digite o CID ou nome da condição para ver medicamentos sugeridos</Text>
            <TextInput
              style={st.input}
              value={cidQuery}
              onChangeText={setCidQuery}
              placeholder="Ex: J00, G43, gastrite..."
              placeholderTextColor={colors.textMuted}
            />
            {cidResults.length > 0 && (
              <View style={st.cidResults}>
                {cidResults.map((cid) => (
                  <View key={cid.cid} style={st.cidItem}>
                    <Text style={st.cidLabel}>{cid.cid} – {cid.description}</Text>
                    {cid.medications.map((med, j) => (
                      <View key={j} style={st.cidMedRow}>
                        <Text style={st.cidMedText} numberOfLines={1}>{med}</Text>
                        <TouchableOpacity onPress={() => addFromCid(med)} style={st.plusBtn} hitSlop={8}>
                          <Ionicons name="add-circle" size={24} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </DoctorCard>

          {/* Medications List */}
          <DoctorCard style={st.cardMargin}>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>MEDICAMENTOS NA RECEITA</Text>
              <TouchableOpacity onPress={addCustom} style={st.addBtn} activeOpacity={0.7}>
                <Ionicons name="add-circle" size={22} color={colors.primary} />
                <Text style={st.addBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
            <Text style={st.hint}>
              Formato: Nome — posologia — quantidade (ex: Dipirona 500mg — 1cp 6/6h — 20 comprimidos)
            </Text>
            {medications.length === 0 ? (
              <Text style={st.emptyHint}>Nenhum medicamento. Use + nas sugestões, busque por CID ou adicione.</Text>
            ) : (
              medications.map((med, i) => (
                <View key={i} style={st.medRow}>
                  <TextInput
                    style={st.medInput}
                    value={med}
                    onChangeText={(v) => updateMedication(i, v)}
                    placeholder={`Medicamento ${i + 1}`}
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity onPress={() => removeMedication(i)} style={st.removeBtn} hitSlop={8}>
                    <Ionicons name="remove-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </DoctorCard>

          {/* Notes */}
          <DoctorCard style={st.cardMargin}>
            <Text style={st.sectionTitle}>OBSERVAÇÕES GERAIS</Text>
            <TextInput
              style={st.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex: Uso contínuo, evitar álcool, etc."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          </DoctorCard>

          {/* Sign Form */}
          {showSignForm && (
            <DoctorCard style={[st.cardMargin, st.signFormCard]}>
              <View style={st.signFormHeader}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <Text style={st.signFormTitle}>ASSINATURA DIGITAL</Text>
              </View>
              <Text style={st.signFormDesc}>
                Ao assinar, você confirma que revisou toda a receita. A assinatura digital é válida conforme ITI/ICP-Brasil.
              </Text>
              <Text style={st.signLabel}>Senha do certificado A1:</Text>
              <TextInput
                style={st.input}
                value={certPassword}
                onChangeText={setCertPassword}
                placeholder="Senha"
                secureTextEntry
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <View style={st.signBtns}>
                <TouchableOpacity
                  style={st.cancelSignBtn}
                  onPress={() => { setShowSignForm(false); setCertPassword(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={st.cancelSignText}>Cancelar</Text>
                </TouchableOpacity>
                <PrimaryButton label="Assinar e enviar" onPress={handleSign} loading={signing} style={st.signConfirmBtn} />
              </View>
            </DoctorCard>
          )}
        </ScrollView>

        {/* Bottom Action Bar */}
        {!showSignForm && (
          <View style={[st.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <PrimaryButton
              label="Salvar e atualizar preview"
              onPress={handleSave}
              loading={saving}
              style={st.bottomPrimaryBtn}
            />
            <PrimaryButton
              label="Assinar Digitalmente"
              onPress={() => setShowSignForm(true)}
              style={st.bottomPrimaryBtn}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },

  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: doctorDS.screenPaddingHorizontal,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 18, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },

  scroll: { flex: 1 },
  scrollContent: { padding: doctorDS.screenPaddingHorizontal, paddingBottom: 100 },

  cardMargin: { marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },

  // PDF Preview
  pdfCard: { borderWidth: 1.5, borderColor: colors.primary + '30' },
  pdfHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pdfTitle: { fontSize: 16, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.primarySoft, borderRadius: borderRadius.sm },
  refreshBtnText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  pdfContainer: { marginTop: spacing.sm, overflow: 'hidden', borderRadius: 8 },
  iframeWrapper: { width: '100%', flex: 1, overflow: 'hidden', borderRadius: 8 },
  webview: { width: '100%', height: Math.min(600, Dimensions.get('window').height - 200) },
  pdfPlaceholder: { height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8 },
  pdfPlaceholderText: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  retryBtn: { marginTop: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.md, backgroundColor: colors.primarySoft, borderRadius: 8 },
  retryBtnText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  validityText: { fontSize: 12, fontFamily: typography.fontFamily.semibold, color: colors.success, marginTop: 2, fontWeight: '600' },

  // AI Card
  aiCard: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.accent },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs, flexWrap: 'wrap' },
  aiTitle: { fontSize: 16, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text, flex: 1 },
  riskBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
  riskText: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700' },
  aiDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(0,119,182,0.06)', borderRadius: 6 },
  aiDisclaimerText: { fontSize: 11, fontFamily: typography.fontFamily.regular, color: colors.textMuted, fontStyle: 'italic' },
  aiSummary: { fontSize: 15, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 24, letterSpacing: 0.2 },
  urgencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  urgencyText: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },

  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm, textTransform: 'uppercase' as any },
  hint: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, marginBottom: spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },

  // Suggestions
  suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  suggestionText: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, marginRight: spacing.sm },
  plusMinusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plusMinusBtn: { padding: 4 },

  // CID
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cidResults: { marginTop: spacing.xs },
  cidItem: { marginBottom: spacing.md },
  cidLabel: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary, marginBottom: spacing.xs },
  cidMedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  cidMedText: { flex: 1, fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },
  plusBtn: { padding: 4 },

  // Medications
  emptyHint: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  medInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeBtn: { padding: 8 },

  // Notes
  notesInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Kind selector
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kindOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kindOptionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  kindOptionText: { fontSize: 14, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.text },
  kindOptionTextActive: { color: colors.primary, fontWeight: '700', fontFamily: typography.fontFamily.bold },

  // Sign Form
  signFormCard: { borderWidth: 1.5, borderColor: colors.primary + '40' },
  signFormHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  signFormTitle: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  signFormDesc: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  signLabel: { fontSize: 14, fontFamily: typography.fontFamily.medium, color: colors.textSecondary, marginBottom: spacing.sm },
  signBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelSignBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cancelSignText: { fontFamily: typography.fontFamily.semibold, color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
  signConfirmBtn: { flex: 1, flexDirection: 'row', backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.card, alignItems: 'center', justifyContent: 'center', gap: 6, ...shadows.button },

  // Bottom Action Bar
  bottomBar: {
    paddingHorizontal: doctorDS.screenPaddingHorizontal,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    ...shadows.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.card,
    ...shadows.button,
  },
  saveBtn: { backgroundColor: colors.primary },
  signPrimaryBtn: { flex: 1 },
  bottomPrimaryBtn: { flex: 1 },
  btnText: { fontSize: 16, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: '#fff' },
});
