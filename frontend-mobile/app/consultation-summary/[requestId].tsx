/**
 * Tela de Resumo da Consulta — Exibida após o médico encerrar a videochamada.
 * Mostra: anamnese estruturada, transcrição, sugestões IA, notas clínicas.
 * Anamnese e nota clínica são salvos automaticamente no prontuário do paciente.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import { fetchRequestById, saveConsultationSummary } from '../../lib/api';
import type { RequestResponseDto } from '../../types/database';
import { parseAnamnesis } from '../../lib/domain/anamnesis';
import { AnamnesisCard } from '../../components/prontuario/AnamnesisCard';
import { SoapNotesCard } from '../../components/prontuario/SoapNotesCard';

export default function ConsultationSummaryScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const S = useMemo(() => makeStyles(colors), [colors]);

  const rid = (Array.isArray(requestId) ? requestId[0] : requestId) ?? '';

  // Paciente não precisa ver resumo da consulta (IA, anamnese, etc.) — redireciona para o pedido
  const isPatient = user != null && user.role !== 'doctor';
  useEffect(() => {
    if (isPatient && rid) {
      router.replace(`/request-detail/${rid}`);
    }
  }, [isPatient, rid, router]);

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState(false);
  const [clinicalNote, setClinicalNote] = useState('');
  const initialSaveDone = useRef(false);

  const anamnesis = useMemo(
    () => parseAnamnesis(request?.consultationAnamnesis),
    [request?.consultationAnamnesis]
  );

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
      .catch(() => {
        Alert.alert('Erro', 'Não foi possível carregar o resumo da consulta.');
        router.back();
      })
      .finally(() => setLoading(false));
  }, [rid, router]);

  /** Salva anamnese e nota clínica no prontuário automaticamente. Apenas médico pode salvar. */
  const saveToRecord = useCallback(async (anamnesisJson: string | null, plan: string) => {
    if (!rid || user?.role !== 'doctor') return;
    try {
      await saveConsultationSummary(rid, {
        anamnesis: anamnesisJson ?? undefined,
        plan: plan.trim() || undefined,
      });
    } catch {
      // Silencioso — o backend já salvou na finalização; este é um refresh
    }
  }, [rid, user?.role]);

  const lastSavedNote = useRef<string | null>(null);
  const userHasEdited = useRef(false);

  /** Auto-save ao carregar: garante anamnese e nota no prontuário (apenas médico). */
  useEffect(() => {
    if (!request || !rid || initialSaveDone.current || user?.role !== 'doctor') return;
    initialSaveDone.current = true;
    const plan = request.notes ?? '';
    lastSavedNote.current = plan;
    saveToRecord(request.consultationAnamnesis ?? null, plan);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- user?.role guard; saveToRecord already depends on it
  }, [request, rid, saveToRecord]);

  /** Auto-save ao editar a nota clínica (debounce 2s). Só quando o usuário alterou. Apenas médico. */
  useEffect(() => {
    if (!rid || !request || !userHasEdited.current || user?.role !== 'doctor') return;
    if (lastSavedNote.current === clinicalNote) return;
    const t = setTimeout(() => {
      lastSavedNote.current = clinicalNote;
      saveToRecord(request.consultationAnamnesis ?? null, clinicalNote);
    }, 2000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- user?.role guard
  }, [clinicalNote, rid, request, saveToRecord]);

  const copyText = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', `${label} copiado para área de transferência.`);
  };

  if (isPatient && rid) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Resumo da Consulta</Text>
          <Text style={S.headerSub}>{request.patientName ?? 'Paciente'}</Text>
        </View>
        <View style={S.headerBadge}>
          <Ionicons name="sparkles" size={12} color={colors.text} />
          <Text style={S.headerBadgeText}>IA</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Anamnesis Section — shared component */}
        {hasAnamnesis && anamnesis && (
          <AnamnesisCard
            data={anamnesis}
            compact
            showAlerts
            showMedsSuggestions
            showExamsSuggestions
            style={S.section}
          />
        )}

        {/* SOAP Notes — geradas pela IA após a consulta */}
        {request?.consultationSoapNotes && (
          <View style={S.section}>
            <SoapNotesCard soapJson={request.consultationSoapNotes} />
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

        {/* Nota Clínica (editável apenas para médico) */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={S.sectionTitle}>Nota Clínica</Text>
          </View>
          {user?.role === 'doctor' ? (
            <TextInput
              style={S.clinicalNoteInput}
              placeholder="Digite ou edite a nota clínica (salva automaticamente no prontuário)"
              placeholderTextColor={colors.textMuted}
              value={clinicalNote}
              onChangeText={(t) => {
                userHasEdited.current = true;
                setClinicalNote(t);
              }}
              multiline
              numberOfLines={4}
            />
          ) : (
            <Text style={S.clinicalNoteReadOnly}>{clinicalNote || '—'}</Text>
          )}
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
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadText: { color: colors.textMuted, fontSize: 14 },
  errorText: { color: colors.error, fontSize: 15 },
  backBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 10 },
  backBtnText: { color: colors.white, fontWeight: '600' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  headerBack: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  headerSub: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primaryGhost,
  },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: colors.text },

  content: { padding: 16, gap: 16 },

  section: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5, flex: 1 },
  copyIcon: { padding: 6, borderRadius: 8, backgroundColor: colors.primaryGhost },

  field: { gap: 4, paddingLeft: 2 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldIcon: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  fieldLabelText: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, paddingLeft: 30 },

  alertBlock: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, gap: 6 },
  alertText: { fontSize: 13, color: colors.error, lineHeight: 20, paddingLeft: 22 },

  medsBlock: { backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 10, padding: 12, gap: 6 },
  medItem: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  medItemBlock: { marginBottom: 10, paddingLeft: 22 },
  medNum: { color: colors.primaryLight, fontWeight: '700', fontSize: 13, minWidth: 20 },
  medNome: { color: colors.primaryLight, fontSize: 13, lineHeight: 20, flex: 1, fontWeight: '600' },
  medText: { color: colors.primaryLight, fontSize: 13, lineHeight: 20, flex: 1 },
  medIndicacao: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginLeft: 20, lineHeight: 18 },
  examItemBlock: { marginBottom: 10, paddingLeft: 22 },
  examDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginLeft: 20, lineHeight: 18 },
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
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  footerDisclaimerText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, flex: 1 },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  clinicalNoteInput: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  clinicalNoteReadOnly: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    paddingVertical: 8,
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
  });
}
