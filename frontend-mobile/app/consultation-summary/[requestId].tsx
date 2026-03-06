/**
 * Tela de Resumo da Consulta — Exibida após o médico encerrar a videochamada.
 * Mostra: anamnese estruturada, transcrição, sugestões IA, notas clínicas.
 * O médico pode revisar, editar e salvar no prontuário.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { fetchRequestById, saveConsultationSummary } from '../../lib/api';
import type { RequestResponseDto } from '../../types/database';

// ── Anamnesis fields mapping ──

export default function ConsultationSummaryScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const S = useMemo(() => makeStyles(colors), [colors]);
  const ANA_FIELDS = useMemo(() => [
    { key: 'queixa_principal', label: 'Queixa Principal', icon: 'chatbubble-ellipses' as const, color: colors.primary },
    { key: 'historia_doenca_atual', label: 'História da Doença Atual', icon: 'time' as const, color: colors.primary },
    { key: 'sintomas', label: 'Sintomas', icon: 'thermometer' as const, color: colors.warning },
    { key: 'medicamentos_em_uso', label: 'Medicamentos em Uso', icon: 'medical' as const, color: colors.primaryLight },
    { key: 'alergias', label: 'Alergias', icon: 'warning' as const, color: colors.error },
    { key: 'antecedentes_relevantes', label: 'Antecedentes', icon: 'document-text' as const, color: colors.textMuted },
    { key: 'cid_sugerido', label: 'CID Sugerido', icon: 'code-slash' as const, color: colors.success },
    { key: 'outros', label: 'Outras Informações', icon: 'ellipsis-horizontal' as const, color: colors.textMuted },
  ], [colors]);

  const rid = (Array.isArray(requestId) ? requestId[0] : requestId) ?? '';

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState(false);
  const [clinicalNote, setClinicalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Parse data
  const anamnesis = useMemo(() => {
    if (!request?.consultationAnamnesis) return null;
    try {
      return JSON.parse(request.consultationAnamnesis);
    } catch {
      return null;
    }
  }, [request?.consultationAnamnesis]);

  const suggestions = useMemo(() => {
    if (!request?.consultationAiSuggestions) return [];
    try {
      const parsed = JSON.parse(request.consultationAiSuggestions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [request?.consultationAiSuggestions]);

  const transcript = request?.consultationTranscript ?? '';
  const hasAnamnesis = anamnesis && Object.keys(anamnesis).length > 0;
  const hasSuggestions = suggestions.length > 0;
  const hasTranscript = transcript.length > 0;

  useEffect(() => {
    if (!rid) return;
    fetchRequestById(rid)
      .then((r) => {
        setRequest(r);
        setClinicalNote(r.notes ?? '');
      })
      .catch((e) => {
        Alert.alert('Erro', 'Não foi possível carregar o resumo da consulta.');
        router.back();
      })
      .finally(() => setLoading(false));
  }, [rid]);

  const handleSaveToRecord = async () => {
    if (!rid) return;
    setSaving(true);
    try {
      await saveConsultationSummary(rid, { plan: clinicalNote.trim() || undefined });
      setSaved(true);
      Alert.alert('Sucesso', 'Nota clínica salva no prontuário.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar no prontuário. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', `${label} copiado para área de transferência.`);
  };

  const copyFullAnamnesis = () => {
    if (!anamnesis) return;
    const lines: string[] = [];
    for (const { key, label } of ANA_FIELDS) {
      const val = anamnesis[key];
      if (!val || (typeof val === 'string' && !val.trim())) continue;
      const display = Array.isArray(val) ? val.join(', ') : String(val);
      lines.push(`${label}: ${display}`);
    }
    // Add alerts if present
    if (Array.isArray(anamnesis.alertas_vermelhos)) {
      for (const a of anamnesis.alertas_vermelhos) {
        lines.push(`⚠️ ALERTA: ${a}`);
      }
    }
    if (Array.isArray(anamnesis.medicamentos_sugeridos)) {
      lines.push('');
      lines.push('Medicamentos Sugeridos:');
      for (const m of anamnesis.medicamentos_sugeridos) {
        lines.push(`  • ${m}`);
      }
    }
    copyText(lines.join('\n'), 'Anamnese');
  };

  if (loading) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={S.loadText}>Carregando resumo...</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={[S.container, S.center]}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={S.errorText}>Consulta não encontrada</Text>
        <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
          <Text style={S.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={S.headerBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={colors.border} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Resumo da Consulta</Text>
          <Text style={S.headerSub}>{request.patientName || 'Paciente'}</Text>
        </View>
        <View style={S.headerBadge}>
          <Ionicons name="sparkles" size={12} color={colors.primary} />
          <Text style={S.headerBadgeText}>IA</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Anamnesis Section */}
        {hasAnamnesis && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Ionicons name="document-text" size={18} color={colors.primary} />
              <Text style={S.sectionTitle}>Anamnese Estruturada</Text>
              <TouchableOpacity style={S.copyIcon} onPress={copyFullAnamnesis}>
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {ANA_FIELDS.map(({ key, label, icon, color }) => {
              const val = anamnesis[key];
              if (!val || (typeof val === 'string' && !val.trim())) return null;
              const display = Array.isArray(val) ? val.join(', ') : String(val);
              const isAlert = key === 'alergias';
              return (
                <View key={key} style={S.field}>
                  <View style={S.fieldLabel}>
                    <View style={[S.fieldIcon, { backgroundColor: `${color}15` }]}>
                      <Ionicons name={icon as any} size={13} color={color} />
                    </View>
                    <Text style={[S.fieldLabelText, isAlert && { color: colors.error }]}>{label}</Text>
                  </View>
                  <Text style={S.fieldValue}>{display}</Text>
                </View>
              );
            })}

            {/* Red alerts */}
            {Array.isArray(anamnesis.alertas_vermelhos) && anamnesis.alertas_vermelhos.length > 0 && (
              <View style={S.alertBlock}>
                <View style={S.fieldLabel}>
                  <Ionicons name="alert-circle" size={15} color={colors.error} />
                  <Text style={[S.fieldLabelText, { color: colors.error, fontWeight: '700' }]}>
                    ALERTAS VERMELHOS
                  </Text>
                </View>
                {(anamnesis.alertas_vermelhos as string[]).map((a: string, i: number) => (
                  <Text key={i} style={S.alertText}>⚠️ {a}</Text>
                ))}
              </View>
            )}

            {/* Suggested medications */}
            {Array.isArray(anamnesis.medicamentos_sugeridos) && anamnesis.medicamentos_sugeridos.length > 0 && (
              <View style={S.medsBlock}>
                <View style={S.fieldLabel}>
                  <Ionicons name="medkit" size={15} color={colors.primaryLight} />
                  <Text style={[S.fieldLabelText, { color: colors.primaryLight }]}>
                    MEDICAMENTOS SUGERIDOS
                  </Text>
                </View>
                {(anamnesis.medicamentos_sugeridos as string[]).map((m: string, i: number) => (
                  <View key={i} style={S.medItem}>
                    <Text style={S.medNum}>{i + 1}.</Text>
                    <Text style={S.medText}>{m}</Text>
                  </View>
                ))}
                <Text style={S.disclaimer}>* Sugestões da IA — decisão final do médico</Text>
              </View>
            )}
          </View>
        )}

        {/* AI Suggestions */}
        {hasSuggestions && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Ionicons name="bulb" size={18} color={colors.primaryLight} />
              <Text style={[S.sectionTitle, { color: colors.primaryLight }]}>Sugestões Clínicas</Text>
            </View>
            {suggestions.map((s: string, i: number) => {
              const isRed = s.startsWith('🚨');
              return (
                <View key={i} style={[S.suggestionItem, isRed && S.suggestionDanger]}>
                  <Ionicons
                    name={isRed ? 'alert-circle' : 'bulb-outline'}
                    size={16}
                    color={isRed ? colors.error : colors.primaryLight}
                  />
                  <Text style={[S.suggestionText, isRed && { color: colors.error }]}>
                    {s.replace('🚨 ', '')}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Nota Clínica (editável) */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={S.sectionTitle}>Nota Clínica</Text>
          </View>
          <TextInput
            style={S.clinicalNoteInput}
            placeholder="Digite ou edite a nota clínica para salvar no prontuário..."
            placeholderTextColor={colors.textMuted}
            value={clinicalNote}
            onChangeText={setClinicalNote}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Transcript */}
        {hasTranscript && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Ionicons name="mic" size={18} color={colors.textMuted} />
              <Text style={S.sectionTitle}>Transcrição</Text>
              <TouchableOpacity
                style={S.copyIcon}
                onPress={() => copyText(transcript, 'Transcrição')}
              >
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setExpandedTranscript(!expandedTranscript)}
              activeOpacity={0.7}
            >
              <Text
                style={S.transcriptText}
                numberOfLines={expandedTranscript ? undefined : 8}
              >
                {transcript}
              </Text>
              {!expandedTranscript && transcript.length > 300 && (
                <Text style={S.expandLink}>Toque para expandir...</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Empty state */}
        {!hasAnamnesis && !hasSuggestions && !hasTranscript && (
          <View style={S.emptyState}>
            <Ionicons name="sparkles-outline" size={48} color={colors.textSecondary} />
            <Text style={S.emptyTitle}>Sem dados da IA</Text>
            <Text style={S.emptySub}>
              A transcrição e anamnese automática não foram geradas para esta consulta.
              Verifique se a gravação foi iniciada durante a chamada.
            </Text>
          </View>
        )}

        {/* Footer disclaimer */}
        <View style={S.footerDisclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={S.footerDisclaimerText}>
            Conteúdo gerado por IA como apoio à decisão clínica. A revisão e validação
            médica são obrigatórias. Conformidade com CFM Resolução 2.299/2021.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={[S.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[S.actionBtn, S.actionBtnSecondary]}
          onPress={handleSaveToRecord}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="save-outline" size={20} color={colors.primary} />
          )}
          <Text style={[S.actionBtnText, { color: colors.primary }]}>
            {saved ? 'Salvo' : 'Salvar no prontuário'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={S.actionBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.white} />
          <Text style={S.actionBtnText}>Concluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ──

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadText: { color: colors.textMuted, fontSize: 14 },
  errorText: { color: colors.errorLight, fontSize: 15 },
  backBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 10 },
  backBtnText: { color: colors.white, fontWeight: '600' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51,65,85,0.3)',
    gap: 12,
  },
  headerBack: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(51,65,85,0.5)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.border, fontSize: 17, fontWeight: '700' },
  headerSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(44,177,255,0.1)',
  },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  content: { padding: 16, gap: 16 },

  section: {
    backgroundColor: 'rgba(30,41,59,0.6)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5, flex: 1 },
  copyIcon: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(44,177,255,0.1)' },

  field: { gap: 4, paddingLeft: 2 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldIcon: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  fieldLabelText: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, color: colors.border, lineHeight: 21, paddingLeft: 30 },

  alertBlock: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, gap: 6 },
  alertText: { fontSize: 13, color: colors.errorLight, lineHeight: 20, paddingLeft: 22 },

  medsBlock: { backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 10, padding: 12, gap: 6 },
  medItem: { flexDirection: 'row', gap: 6, paddingLeft: 22 },
  medNum: { color: colors.primaryLight, fontWeight: '700', fontSize: 13 },
  medText: { color: colors.primaryLight, fontSize: 13, lineHeight: 20, flex: 1 },
  disclaimer: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', paddingLeft: 22, marginTop: 4 },

  suggestionItem: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingLeft: 2 },
  suggestionDanger: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 8 },
  suggestionText: { fontSize: 13, color: colors.primaryLight, lineHeight: 20, flex: 1 },

  transcriptText: { fontSize: 13, color: colors.textMuted, lineHeight: 21 },
  expandLink: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 6 },

  emptyState: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  footerDisclaimer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(30,41,59,0.4)',
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  footerDisclaimerText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, flex: 1 },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51,65,85,0.3)',
    backgroundColor: 'rgba(15,23,42,0.95)',
  },
  clinicalNoteInput: {
    backgroundColor: 'rgba(15,23,42,0.5)',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 14,
  },
  actionBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  actionBtnSecondary: {
    backgroundColor: 'rgba(44,177,255,0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  });
}
