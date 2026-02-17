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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '../../../lib/theme';
import {
  getRequestById,
  signRequest,
  getPreviewPdf,
  updatePrescriptionContent,
} from '../../../lib/api';
import { RequestResponseDto } from '../../../types/database';
import { searchCid } from '../../../lib/cid-medications';
import { ZoomablePdfView } from '../../../components/ZoomablePdfView';

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: '#D1FAE5', text: '#059669' },
  medium: { bg: '#FEF3C7', text: '#D97706' },
  high: { bg: '#FEE2E2', text: '#DC2626' },
};

function parseAiMedications(aiExtractedJson: string | null): string[] {
  if (!aiExtractedJson) return [];
  try {
    const obj = JSON.parse(aiExtractedJson);
    const arr = obj?.medications;
    if (Array.isArray(arr)) {
      return arr.map((m: any) => String(m || '').trim()).filter(Boolean);
    }
  } catch {}
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
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<string[]>([]);
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
      Alert.alert('Obrigatório', 'Adicione ao menos um medicamento à receita.');
      return;
    }
    setSaving(true);
    try {
      await updatePrescriptionContent(requestId, {
        medications: meds,
        notes: notes.trim() || undefined,
      });
      await loadRequest();
      await loadPdfPreview();
      if (Platform.OS === 'web') {
        alert('Alterações salvas. O preview foi atualizado.');
      } else {
        Alert.alert('Salvo', 'Alterações salvas. O preview foi atualizado.');
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!certPassword.trim()) {
      Alert.alert('Obrigatório', 'Digite a senha do certificado.');
      return;
    }
    setSigning(true);
    try {
      await signRequest(requestId, { pfxPassword: certPassword });
      setShowSignForm(false);
      setCertPassword('');
      if (Platform.OS === 'web') {
        alert('Documento assinado com sucesso!');
      } else {
        Alert.alert('Sucesso', 'Documento assinado digitalmente.');
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Senha incorreta ou erro na assinatura.');
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
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (request.requestType !== 'prescription') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={s.title}>Editor</Text>
        </View>
        <View style={s.center}>
          <Text style={{ color: colors.textSecondary }}>Editor disponível apenas para receitas.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pdfViewHeight = Math.min(500, Dimensions.get('window').height - 180);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Visualizar e Editar Receita</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* PREVIEW PDF - em destaque no topo */}
        <View style={[s.card, s.pdfCard]}>
          <View style={s.pdfHeader}>
            <Ionicons name="document-text" size={22} color={colors.primary} />
            <Text style={s.pdfSectionTitle}>Preview da Receita (PDF)</Text>
            <TouchableOpacity onPress={loadPdfPreview} disabled={pdfLoading} style={s.refreshBtn}>
              <Ionicons name="refresh" size={20} color={colors.primary} />
              <Text style={s.refreshBtnText}>Atualizar</Text>
            </TouchableOpacity>
          </View>
          {pdfLoading ? (
            <View style={[s.pdfPlaceholder, { minHeight: pdfViewHeight }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={s.pdfPlaceholderText}>Gerando preview...</Text>
            </View>
          ) : pdfUri ? (
            <View style={[s.pdfContainer, { height: pdfViewHeight }]}>
              {Platform.OS === 'web' ? (
                <View style={s.iframeWrapper}>
                  {/* @ts-ignore - iframe is valid on web */}
                  <iframe
                    src={pdfUri}
                    title="Preview da receita"
                    style={{
                      width: '100%',
                      height: pdfViewHeight,
                      border: 'none',
                      borderRadius: 8,
                      backgroundColor: '#f1f5f9',
                    }}
                  />
                </View>
              ) : (
                <ZoomablePdfView>
                  <WebView
                    source={{ uri: pdfUri }}
                    style={[s.webview, { height: pdfViewHeight }]}
                    scrollEnabled
                    originWhitelist={['*']}
                  />
                </ZoomablePdfView>
              )}
            </View>
          ) : (
            <View style={[s.pdfPlaceholder, { minHeight: 160 }]}>
              <Ionicons name="document-outline" size={40} color={colors.textMuted} />
              <Text style={s.pdfPlaceholderText}>
                Adicione medicamentos e salve para gerar o preview.
              </Text>
              <TouchableOpacity onPress={loadPdfPreview} style={s.retryBtn}>
                <Text style={s.retryBtnText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Análise IA – legível e destacada */}
        {request.aiSummaryForDoctor && (
          <View style={[s.card, s.aiCard]}>
            <View style={s.aiHeader}>
              <Ionicons name="sparkles" size={22} color={colors.primary} />
              <Text style={s.aiTitle}>Análise da IA – apoio à prescrição</Text>
              {request.aiRiskLevel && (
                <View
                  style={[
                    s.riskBadge,
                    { backgroundColor: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.bg || '#E2E8F0' },
                  ]}
                >
                  <Text
                    style={[
                      s.riskText,
                      { color: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text },
                    ]}
                  >
                    {request.aiRiskLevel.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={s.aiSummary}>
              {String(request.aiSummaryForDoctor || '')
                .split(/\n+/)
                .map((p, i) => (p.trim() ? p.trim() : null))
                .filter(Boolean)
                .join('\n\n')}
            </Text>
            {request.aiUrgency && (
              <View style={s.urgencyRow}>
                <Ionicons name="time" size={16} color={colors.textSecondary} />
                <Text style={s.urgencyText}>Urgência: {request.aiUrgency}</Text>
              </View>
            )}
          </View>
        )}

        {/* Sugestões da IA – aceitar (+) ou rejeitar (−) */}
        {suggestedFromAi.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>SUGESTÕES DA IA</Text>
            <Text style={s.hint}>Clique + para adicionar ao PDF ou − para rejeitar</Text>
            {suggestedFromAi.map((med, i) => (
              <View key={`sug-${i}`} style={s.suggestionRow}>
                <Text style={s.suggestionText} numberOfLines={2}>{med}</Text>
                <View style={s.plusMinusRow}>
                  <TouchableOpacity onPress={() => acceptSuggestion(med)} style={s.plusMinusBtn}>
                    <Ionicons name="add-circle" size={28} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => rejectSuggestion(med)} style={s.plusMinusBtn}>
                    <Ionicons name="remove-circle" size={28} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Buscar por CID – medicamentos compatíveis */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>BUSCAR POR CID</Text>
          <Text style={s.hint}>Digite o CID ou nome da condição para ver medicamentos sugeridos</Text>
          <TextInput
            style={s.cidInput}
            value={cidQuery}
            onChangeText={setCidQuery}
            placeholder="Ex: J00, G43, gastrite..."
            placeholderTextColor={colors.textMuted}
          />
          {cidResults.length > 0 && (
            <View style={s.cidResults}>
              {cidResults.map((cid) => (
                <View key={cid.cid} style={s.cidItem}>
                  <Text style={s.cidLabel}>{cid.cid} – {cid.description}</Text>
                  {cid.medications.map((med, j) => (
                    <View key={j} style={s.cidMedRow}>
                      <Text style={s.cidMedText} numberOfLines={1}>{med}</Text>
                      <TouchableOpacity onPress={() => addFromCid(med)} style={s.plusBtn}>
                        <Ionicons name="add-circle" size={24} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Medicamentos na receita (vão para o PDF) */}
        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>MEDICAMENTOS NA RECEITA (PDF)</Text>
            <TouchableOpacity onPress={addCustom} style={s.addBtn}>
              <Ionicons name="add-circle" size={22} color={colors.primary} />
              <Text style={s.addBtnText}>Adicionar outro</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.hint}>
            Formato: Nome — posologia — quantidade (ex: Dipirona 500mg — 1cp 6/6h — 20 comprimidos)
          </Text>
          {medications.length === 0 ? (
            <Text style={s.emptyHint}>Nenhum medicamento. Use + nas sugestões, busque por CID ou adicione outro.</Text>
          ) : (
            medications.map((med, i) => (
              <View key={i} style={s.medRow}>
                <TextInput
                  style={s.medInput}
                  value={med}
                  onChangeText={(v) => updateMedication(i, v)}
                  placeholder={`Medicamento ${i + 1}`}
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity onPress={() => removeMedication(i)} style={s.removeBtn}>
                  <Ionicons name="remove-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Observações */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>OBSERVAÇÕES GERAIS</Text>
          <TextInput
            style={s.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: Uso contínuo, evitar álcool, etc."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Botões Salvar e Assinar */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btn, s.saveBtn]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={s.btnText}>Salvar e atualizar preview</Text>
              </>
            )}
          </TouchableOpacity>

          {showSignForm ? (
            <View style={s.signForm}>
              <Text style={s.signLabel}>Senha do certificado A1:</Text>
              <TextInput
                style={s.certInput}
                value={certPassword}
                onChangeText={setCertPassword}
                placeholder="Senha"
                secureTextEntry
                placeholderTextColor={colors.textMuted}
              />
              <View style={s.signBtns}>
                <TouchableOpacity
                  style={[s.btn, s.cancelSignBtn]}
                  onPress={() => {
                    setShowSignForm(false);
                    setCertPassword('');
                  }}
                >
                  <Text style={s.cancelSignText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, s.signBtn]}
                  onPress={handleSign}
                  disabled={signing}
                >
                  {signing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="create" size={20} color="#fff" />
                      <Text style={s.btnText}>Assinar e enviar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.btn, s.signPrimaryBtn]}
              onPress={() => setShowSignForm(true)}
            >
              <Ionicons name="create" size={20} color="#fff" />
              <Text style={s.btnText}>Assinar Digitalmente</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  pdfCard: { borderWidth: 2, borderColor: colors.primary + '30' },
  pdfHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pdfSectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  refreshBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  iframeWrapper: { width: '100%', flex: 1, overflow: 'hidden', borderRadius: 8 },
  retryBtn: { marginTop: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.md, backgroundColor: colors.primary + '20', borderRadius: 8 },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  aiCard: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  aiTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  riskBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
  riskText: { fontSize: 12, fontWeight: '700' },
  aiSummary: { fontSize: 16, color: colors.text, lineHeight: 26, letterSpacing: 0.2 },
  urgencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  urgencyText: { fontSize: 13, color: colors.textSecondary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionText: { flex: 1, fontSize: 14, color: colors.text, marginRight: spacing.sm },
  plusMinusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plusMinusBtn: { padding: 4 },
  cidInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cidResults: { marginTop: spacing.xs },
  cidItem: { marginBottom: spacing.md },
  cidLabel: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: spacing.xs },
  cidMedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  cidMedText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  plusBtn: { padding: 4 },
  emptyHint: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  medInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeBtn: { padding: 8 },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: { gap: spacing.sm, marginBottom: spacing.md },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
  },
  saveBtn: { backgroundColor: colors.primary },
  signPrimaryBtn: { backgroundColor: '#8B5CF6' },
  signBtn: { backgroundColor: '#8B5CF6' },
  cancelSignBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cancelSignText: { color: colors.textSecondary, fontWeight: '600' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  signForm: { gap: spacing.sm },
  signLabel: { fontSize: 14, color: colors.textSecondary },
  certInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signBtns: { flexDirection: 'row', gap: spacing.sm },
  pdfContainer: { marginTop: spacing.sm, overflow: 'hidden', borderRadius: 8 },
  webview: {
    width: '100%',
    height: Math.min(600, Dimensions.get('window').height - 200),
  },
  pdfPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  pdfPlaceholderText: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
});
