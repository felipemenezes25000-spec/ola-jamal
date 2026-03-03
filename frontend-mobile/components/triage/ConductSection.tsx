/**
 * ConductSection — Seção de conduta médica (Doctor Editor)
 *
 * Design com themeDoctor.ts (Stitch Ocean Blue).
 * Features: TextArea, sugestão IA (usar/adicionar/ignorar), chips exames, toggle PDF.
 * Auto-observation readonly com visual diferenciado.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, doctorDS, typography } from '../../lib/themeDoctor';

interface ConductSectionProps {
  /** Valor atual da conduta */
  value: string;
  /** Callback ao alterar */
  onChangeText: (text: string) => void;
  /** Sugestão de conduta da IA (pode ser null) */
  aiSuggestion?: string | null;
  /** Exames sugeridos pela IA */
  suggestedExams?: string[];
  /** Incluir conduta no PDF */
  includeInPdf: boolean;
  /** Toggle para incluir no PDF */
  onTogglePdf: (value: boolean) => void;
  /** Observação automática (readonly, gerada pelo sistema) */
  autoObservation?: string | null;
}

export function ConductSection({
  value, onChangeText, aiSuggestion, suggestedExams,
  includeInPdf, onTogglePdf, autoObservation,
}: ConductSectionProps) {
  const [showSuggestion, setShowSuggestion] = useState(!!aiSuggestion);

  const useSuggestion = useCallback(() => {
    if (aiSuggestion) {
      onChangeText(aiSuggestion);
      setShowSuggestion(false);
    }
  }, [aiSuggestion, onChangeText]);

  const appendSuggestion = useCallback(() => {
    if (aiSuggestion) {
      const sep = value.trim() ? '\n\n' : '';
      onChangeText(value + sep + aiSuggestion);
      setShowSuggestion(false);
    }
  }, [aiSuggestion, value, onChangeText]);

  const addExam = useCallback((exam: string) => {
    const sep = value.trim() ? '\n' : '';
    onChangeText(value + sep + `Sugiro exame complementar: ${exam}.`);
  }, [value, onChangeText]);

  return (
    <View style={styles.section}>
      {/* ── Section Header ──────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Ionicons name="clipboard" size={16} color={colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>CONDUTA MÉDICA</Text>
        {aiSuggestion && (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={9} color="#7C3AED" />
            <Text style={styles.aiBadgeText}>Sugestão IA</Text>
          </View>
        )}
      </View>
      <Text style={styles.hint}>
        Registre suas recomendações para o paciente. A decisão clínica é exclusivamente sua. Sugestões da IA são apenas auxílio.
      </Text>

      {/* ── Auto Observation (readonly) ─────────────────────── */}
      {autoObservation ? (
        <View style={styles.autoObsCard}>
          <View style={styles.autoObsHeader}>
            <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
            <Text style={styles.autoObsLabel}>Observação automática</Text>
            <View style={styles.autoObsBadge}>
              <Text style={styles.autoObsBadgeText}>No documento</Text>
            </View>
          </View>
          <Text style={styles.autoObsText}>{autoObservation}</Text>
        </View>
      ) : null}

      {/* ── AI Suggestion Card ─────────────────────────────── */}
      {aiSuggestion && showSuggestion ? (
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <View style={styles.aiIconCircle}>
              <Ionicons name="sparkles" size={14} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiCardTitle}>Sugestão de conduta (IA)</Text>
              <Text style={styles.aiCardSubtitle}>Apenas sugestão — a decisão final é sua</Text>
            </View>
          </View>
          <Text style={styles.aiCardText}>{aiSuggestion}</Text>
          <View style={styles.aiCardActions}>
            <Pressable
              style={({ pressed }) => [styles.aiBtn, styles.aiBtnPrimary, pressed && styles.pressed]}
              onPress={useSuggestion}
            >
              <Ionicons name="checkmark" size={14} color={colors.white} />
              <Text style={styles.aiBtnPrimaryText}>Usar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.aiBtn, styles.aiBtnSecondary, pressed && styles.pressed]}
              onPress={appendSuggestion}
            >
              <Ionicons name="add" size={14} color="#7C3AED" />
              <Text style={styles.aiBtnSecondaryText}>Adicionar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.aiBtn, pressed && styles.pressed]}
              onPress={() => setShowSuggestion(false)}
            >
              <Text style={styles.aiBtnGhostText}>Ignorar</Text>
            </Pressable>
          </View>
          <Text style={styles.aiDisclaimer}>
            Sugestão auxiliar gerada por IA · A decisão final é exclusivamente do médico · Revise antes de usar
          </Text>
        </View>
      ) : null}

      {/* ── Suggested Exam Chips ───────────────────────────── */}
      {suggestedExams && suggestedExams.length > 0 ? (
        <View style={styles.examsWrap}>
          <Text style={styles.examsLabel}>Exames complementares sugeridos:</Text>
          <View style={styles.chips}>
            {suggestedExams.map((exam, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                onPress={() => addExam(exam)}
                accessibilityLabel={`Adicionar exame ${exam} à conduta`}
              >
                <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
                <Text style={styles.chipText}>{exam}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── TextArea ───────────────────────────────────────── */}
      <TextInput
        style={styles.textarea}
        value={value}
        onChangeText={onChangeText}
        placeholder="Ex: Sugiro retorno ao médico assistente em 30 dias para reavaliação..."
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        accessibilityLabel="Campo de conduta médica"
      />

      {/* ── PDF Toggle ─────────────────────────────────────── */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleLeft}>
          <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.toggleLabel}>Incluir conduta no PDF assinado</Text>
        </View>
        <Switch
          value={includeInPdf}
          onValueChange={onTogglePdf}
          trackColor={{ false: colors.border, true: '#BBF7D0' }}
          thumbColor={includeInPdf ? colors.success : '#CBD5E1'}
          ios_backgroundColor={colors.border}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.lg,
    gap: 0,
  },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  headerIcon: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', fontFamily: typography.fontFamily.bold,
    letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase',
    flex: 1,
  },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EDE9FE', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 100,
  },
  aiBadgeText: { fontSize: 9, fontWeight: '700', color: '#7C3AED', letterSpacing: 0.2 },
  hint: {
    fontSize: 12, lineHeight: 17, color: colors.textMuted,
    fontFamily: typography.fontFamily.regular, marginBottom: 14,
  },

  // Auto observation card
  autoObsCard: {
    backgroundColor: '#EFF6FF', borderRadius: borderRadius.sm, padding: 12, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  autoObsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5,
  },
  autoObsLabel: { fontSize: 11, fontWeight: '600', color: colors.primaryDark, flex: 1 },
  autoObsBadge: {
    backgroundColor: colors.primarySoft, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 100,
  },
  autoObsBadgeText: { fontSize: 8, fontWeight: '700', color: colors.primary, letterSpacing: 0.3 },
  autoObsText: { fontSize: 12, lineHeight: 17, color: colors.textSecondary, fontStyle: 'italic' },

  // AI suggestion card
  aiCard: {
    backgroundColor: '#FAF5FF', borderRadius: borderRadius.sm, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#E9D5FF',
  },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  aiIconCircle: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#EDE9FE',
    alignItems: 'center', justifyContent: 'center',
  },
  aiCardTitle: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  aiCardSubtitle: { fontSize: 10, color: '#A78BFA', marginTop: 1 },
  aiCardText: { fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginBottom: 12 },
  aiCardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.pill,
    minHeight: 32,
  },
  aiBtnPrimary: { backgroundColor: '#7C3AED' },
  aiBtnPrimaryText: { fontSize: 12, fontWeight: '700', color: colors.white },
  aiBtnSecondary: { backgroundColor: '#EDE9FE' },
  aiBtnSecondaryText: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  aiBtnGhostText: { fontSize: 12, fontWeight: '500', color: '#94A3B8' },
  aiDisclaimer: { fontSize: 9, color: '#C4B5FD', fontStyle: 'italic', marginTop: 8 },

  // Exam chips
  examsWrap: { marginBottom: 14 },
  examsLabel: { fontSize: 11.5, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: borderRadius.pill, borderWidth: 1, borderColor: colors.accent,
  },
  chipText: { fontSize: 11.5, fontWeight: '500', color: colors.primaryDark },

  // TextArea
  textarea: {
    backgroundColor: colors.surface, borderRadius: borderRadius.sm, padding: 14,
    fontSize: 13.5, fontFamily: typography.fontFamily.regular, color: colors.text,
    minHeight: 120, maxHeight: 200,
    borderWidth: 1, borderColor: colors.border,
    ...Platform.select({
      ios: shadows.card,
      android: shadows.card,
    }),
  },

  // PDF toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingHorizontal: 2,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },

  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
