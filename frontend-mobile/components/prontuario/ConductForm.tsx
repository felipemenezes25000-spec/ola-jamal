/**
 * ConductForm — Formulário estruturado de conduta/prontuário.
 *
 * 4 campos: Queixa/Duração, Evolução/Anamnese, Hipótese (CID), Conduta.
 * Integração com sugestão de IA e checkbox para incluir no PDF.
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { spacing, borderRadius, typography } from '../../lib/themeDoctor';
import { AppButton, AIActionSheet } from '../ui';
import { showToast } from '../ui/Toast';
import { parseAnamnesis, extractCid, displayMedicamento, displayExame } from '../../lib/domain/anamnesis';

export interface ConductFormData {
  queixaDuracao: string;
  evolucao: string;
  hipoteseCid: string;
  conduta: string;
}

interface ConductFormProps {
  initialData?: Partial<ConductFormData>;
  /** Legacy: single string field for backward compat. If provided, initialData is ignored. */
  legacyConductNotes?: string;
  aiSuggestion?: string | null;
  anamnesisJson?: string | null;
  /** Transcrição da consulta — usada para prefill evolucao quando anamnese não tem historia_doenca_atual */
  consultationTranscript?: string | null;
  /** Sugestões da IA da consulta — usadas para prefill conduta quando vazio */
  consultationSuggestions?: string[];
  includeConductInPdf: boolean;
  onIncludeConductInPdfChange: (v: boolean) => void;
  saving: boolean;
  onSave: (data: ConductFormData, combinedText: string) => void;
  style?: object;
}

function parseStructuredFromLegacy(text: string): ConductFormData {
  const lines = text.split('\n');
  const result: ConductFormData = { queixaDuracao: '', evolucao: '', hipoteseCid: '', conduta: '' };

  let current: keyof ConductFormData | null = null;
  const buffer: Record<string, string[]> = {
    queixaDuracao: [], evolucao: [], hipoteseCid: [], conduta: [],
  };

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    if (lower.startsWith('queixa')) { current = 'queixaDuracao'; continue; }
    if (lower.startsWith('evolu') || lower.startsWith('anamnese')) { current = 'evolucao'; continue; }
    if (lower.startsWith('hipóte') || lower.startsWith('hipote') || lower.startsWith('cid')) { current = 'hipoteseCid'; continue; }
    if (lower.startsWith('conduta')) { current = 'conduta'; continue; }
    if (current) buffer[current].push(line);
  }

  result.queixaDuracao = buffer.queixaDuracao.join('\n').trim();
  result.evolucao = buffer.evolucao.join('\n').trim();
  result.hipoteseCid = buffer.hipoteseCid.join('\n').trim();
  result.conduta = buffer.conduta.join('\n').trim();

  if (!result.queixaDuracao && !result.evolucao && !result.hipoteseCid && !result.conduta) {
    result.conduta = text.trim();
  }

  return result;
}

function combineToConductText(data: ConductFormData): string {
  const parts: string[] = [];
  if (data.queixaDuracao.trim()) parts.push(`Queixa e duração: ${data.queixaDuracao.trim()}`);
  if (data.evolucao.trim()) parts.push(`Evolução / Anamnese: ${data.evolucao.trim()}`);
  if (data.hipoteseCid.trim()) parts.push(`Hipótese diagnóstica (CID): ${data.hipoteseCid.trim()}`);
  if (data.conduta.trim()) parts.push(`Conduta: ${data.conduta.trim()}`);
  return parts.join('\n\n');
}

export function ConductForm({
  initialData,
  legacyConductNotes,
  aiSuggestion,
  anamnesisJson,
  consultationTranscript,
  consultationSuggestions,
  includeConductInPdf,
  onIncludeConductInPdfChange,
  saving,
  onSave,
  style,
}: ConductFormProps) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const S = useMemo(() => makeStyles(colors), [colors]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const initial = useMemo(() => {
    if (legacyConductNotes && legacyConductNotes.trim()) {
      return parseStructuredFromLegacy(legacyConductNotes);
    }
    return {
      queixaDuracao: initialData?.queixaDuracao ?? '',
      evolucao: initialData?.evolucao ?? '',
      hipoteseCid: initialData?.hipoteseCid ?? '',
      conduta: initialData?.conduta ?? '',
    };
  }, [legacyConductNotes, initialData]);

  const [form, setForm] = useState<ConductFormData>(initial);
  const autoPrefillDone = useRef(false);

  /** Auto-prefill a partir da anamnese/IA quando o prontuário está vazio (pós-consulta). */
  useEffect(() => {
    if (autoPrefillDone.current) return;
    const empty = !form.queixaDuracao.trim() && !form.evolucao.trim() && !form.hipoteseCid.trim() && !form.conduta.trim();
    if (!empty) return;
    if (!anamnesisJson && !aiSuggestion) return;

    autoPrefillDone.current = true;
    if (aiSuggestion) {
      const parsed = parseStructuredFromLegacy(aiSuggestion);
      if (parsed.queixaDuracao || parsed.evolucao || parsed.hipoteseCid || parsed.conduta) {
        setForm(parsed);
        return;
      }
      setForm((prev) => ({ ...prev, conduta: aiSuggestion }));
    }
    const anamnesis = parseAnamnesis(anamnesisJson);
    if (anamnesis) {
      setForm((prev) => {
        const next = { ...prev };
        if (!next.queixaDuracao.trim() && anamnesis.queixa_principal) {
          next.queixaDuracao = typeof anamnesis.queixa_principal === 'string' ? anamnesis.queixa_principal : '';
        }
        if (!next.evolucao.trim() && anamnesis.historia_doenca_atual) {
          next.evolucao = typeof anamnesis.historia_doenca_atual === 'string' ? anamnesis.historia_doenca_atual : '';
        }
        if (!next.evolucao.trim() && consultationTranscript?.trim()) {
          next.evolucao = consultationTranscript.trim();
        }
        if (!next.hipoteseCid.trim()) {
          const cid = extractCid(anamnesis);
          if (cid) next.hipoteseCid = cid + (anamnesis.cid_descricao ? ` — ${anamnesis.cid_descricao}` : '');
        }
        if (!next.conduta.trim() && aiSuggestion) next.conduta = aiSuggestion;
        if (!next.conduta.trim() && consultationSuggestions?.length) {
          next.conduta = consultationSuggestions.join('\n\n').trim();
        }
        if (!next.conduta.trim()) {
          const condutaParts: string[] = [];
          const meds = anamnesis.medicamentos_sugeridos;
          if (Array.isArray(meds) && meds.length > 0) {
            condutaParts.push('Medicamentos: ' + meds.map((m) => displayMedicamento(m)).join('; '));
          }
          const exams = anamnesis.exames_sugeridos;
          if (Array.isArray(exams) && exams.length > 0) {
            condutaParts.push('Exames: ' + exams.map((e) => displayExame(e)).join('; '));
          }
          const orient = anamnesis.orientacoes_paciente;
          if (Array.isArray(orient) && orient.length > 0) {
            condutaParts.push('Orientações: ' + orient.join('; '));
          }
          if (condutaParts.length > 0) next.conduta = condutaParts.join('\n\n');
        }
        return next;
      });
    }
  }, [form.queixaDuracao, form.evolucao, form.hipoteseCid, form.conduta, anamnesisJson, aiSuggestion, consultationTranscript, consultationSuggestions]);

  const setField = useCallback((key: keyof ConductFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    const combined = combineToConductText(form);
    onSave(form, combined);
  }, [form, onSave]);

  const isEmpty = !form.queixaDuracao.trim() && !form.evolucao.trim() && !form.hipoteseCid.trim() && !form.conduta.trim();

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return;
    const parsed = parseStructuredFromLegacy(aiSuggestion);
    if (parsed.queixaDuracao || parsed.evolucao || parsed.hipoteseCid || parsed.conduta) {
      setForm(parsed);
    } else {
      setForm((prev) => ({ ...prev, conduta: prev.conduta ? `${prev.conduta}\n\n${aiSuggestion}` : aiSuggestion }));
    }

    const anamnesis = parseAnamnesis(anamnesisJson);
    if (anamnesis) {
      const cid = extractCid(anamnesis);
      if (cid && !form.hipoteseCid.trim()) {
        setForm((prev) => ({ ...prev, hipoteseCid: cid }));
      }
    }
  }, [aiSuggestion, anamnesisJson, form.hipoteseCid]);

  const prefillFromAnamnesis = useCallback(() => {
    const anamnesis = parseAnamnesis(anamnesisJson);
    if (!anamnesis) return;

    setForm((prev) => {
      const next = { ...prev };
      if (!next.queixaDuracao.trim() && anamnesis.queixa_principal) {
        next.queixaDuracao = typeof anamnesis.queixa_principal === 'string' ? anamnesis.queixa_principal : '';
      }
      if (!next.evolucao.trim() && anamnesis.historia_doenca_atual) {
        next.evolucao = typeof anamnesis.historia_doenca_atual === 'string' ? anamnesis.historia_doenca_atual : '';
      }
      if (!next.hipoteseCid.trim()) {
        const cid = extractCid(anamnesis);
        if (cid) next.hipoteseCid = cid + (anamnesis.cid_descricao ? ` — ${anamnesis.cid_descricao}` : '');
      }
      return next;
    });
    showToast({ message: 'Dados da anamnese aplicados', type: 'success' });
  }, [anamnesisJson]);

  const FIELDS: {
    key: keyof ConductFormData;
    label: string;
    placeholder: string;
    minHeight: number;
    icon: string;
  }[] = [
    {
      key: 'queixaDuracao',
      label: 'Queixa e duração',
      placeholder: 'Ex.: Dor lombar há 3 dias, de início súbito...',
      minHeight: 56,
      icon: 'chatbubble-ellipses',
    },
    {
      key: 'evolucao',
      label: 'Evolução / Anamnese',
      placeholder: 'Ex.: Paciente refere piora progressiva, sem irradiação, uso de analgésico sem melhora...',
      minHeight: 80,
      icon: 'time',
    },
    {
      key: 'hipoteseCid',
      label: 'Hipótese diagnóstica (CID)',
      placeholder: 'Ex.: M54.5 — Dor lombar baixa',
      minHeight: 44,
      icon: 'code-slash',
    },
    {
      key: 'conduta',
      label: 'Conduta',
      placeholder: 'Ex.: Visando continuidade do tratamento, prescrevo...',
      minHeight: 80,
      icon: 'clipboard',
    },
  ];

  return (
    <View style={[S.card, style]}>
      {/* Header */}
      <View style={S.header}>
        <View style={S.headerIconWrap}>
          <Ionicons name="journal" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>PRONTUÁRIO / CONDUTA</Text>
          <Text style={S.headerSubtitle}>
            Campos estruturados para registro clínico padronizado
          </Text>
        </View>
      </View>

      {/* AI suggestion */}
      {aiSuggestion ? (
        <View style={S.aiSection}>
          <View style={S.aiHeader}>
            <Ionicons name="bulb" size={16} color={colors.primary} />
            <Text style={S.aiTitle}>Sugestão de conduta da IA</Text>
          </View>
          <Text style={S.aiText} numberOfLines={4}>{aiSuggestion}</Text>
          <TouchableOpacity
            style={S.aiActionBtn}
            onPress={() => setSheetOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal-circle-outline" size={16} color={colors.primary} />
            <Text style={S.aiActionText}>Ações da IA</Text>
          </TouchableOpacity>
          <AIActionSheet
            visible={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Ações da sugestão de conduta"
            subtitle="Copie ou aplique no prontuário com um toque."
            actions={[
              {
                key: 'copy',
                label: 'Copiar sugestão',
                icon: 'copy-outline',
                onPress: async () => {
                  await Clipboard.setStringAsync(aiSuggestion);
                  showToast({ message: 'Sugestão copiada', type: 'success' });
                },
              },
              {
                key: 'apply',
                label: 'Aplicar nos campos',
                icon: 'checkmark-done-outline',
                onPress: applyAiSuggestion,
              },
              {
                key: 'discard',
                label: 'Descartar',
                icon: 'trash-outline',
                destructive: true,
                onPress: () => {},
              },
            ]}
          />
        </View>
      ) : null}

      {/* Prefill from anamnesis */}
      {anamnesisJson && isEmpty && (
        <TouchableOpacity style={S.prefillBtn} onPress={prefillFromAnamnesis} activeOpacity={0.7}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
          <Text style={S.prefillText}>Preencher a partir da anamnese</Text>
        </TouchableOpacity>
      )}

      {/* Structured fields */}
      {FIELDS.map(({ key, label, placeholder, minHeight, icon }) => (
        <View key={key} style={S.fieldGroup}>
          <View style={S.fieldLabelRow}>
            <Ionicons name={icon as any} size={13} color={colors.textMuted} />
            <Text style={S.fieldLabel}>{label}</Text>
          </View>
          <TextInput
            style={[S.fieldInput, { minHeight }]}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            value={form[key]}
            onChangeText={(v) => setField(key, v)}
            multiline
            textAlignVertical="top"
          />
        </View>
      ))}

      {/* Include in PDF checkbox */}
      <TouchableOpacity
        style={S.checkboxRow}
        onPress={() => onIncludeConductInPdfChange(!includeConductInPdf)}
        activeOpacity={0.7}
      >
        <View style={[S.checkbox, includeConductInPdf && S.checkboxActive]}>
          {includeConductInPdf && <Ionicons name="checkmark" size={14} color={colors.white} />}
        </View>
        <Text style={S.checkboxLabel}>
          Incluir esta conduta no PDF e no histórico compartilhado com o paciente.
        </Text>
      </TouchableOpacity>

      {/* Save button */}
      <View style={S.actions}>
        <AppButton
          title="Salvar no prontuário"
          variant="doctorPrimary"
          onPress={handleSave}
          loading={saving}
          disabled={isEmpty}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    headerIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 12,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.5,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    aiSection: {
      backgroundColor: colors.primaryGhost,
      borderRadius: borderRadius.sm,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    aiHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    aiTitle: {
      fontSize: 13,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
      color: colors.text,
    },
    aiText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    aiActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      marginTop: 4,
    },
    aiActionText: {
      fontSize: 13,
      fontFamily: typography.fontFamily.semibold,
      fontWeight: '600',
      color: colors.primary,
    },
    prefillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.primarySoft,
      borderRadius: borderRadius.sm,
      marginBottom: spacing.md,
      alignSelf: 'flex-start',
    },
    prefillText: {
      fontSize: 13,
      fontFamily: typography.fontFamily.semibold,
      fontWeight: '600',
      color: colors.primary,
    },
    fieldGroup: {
      marginBottom: spacing.md,
    },
    fieldLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    fieldInput: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.sm,
      padding: spacing.md,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      fontFamily: typography.fontFamily.regular,
      lineHeight: 21,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: spacing.md,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 19,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
  });
}
