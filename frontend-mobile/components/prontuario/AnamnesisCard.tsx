/**
 * AnamnesisCard — Card reutilizável de anamnese estruturada.
 *
 * Substitui as 3 implementações duplicadas em:
 * - doctor-request/[id].tsx (ConsultationPostSection)
 * - doctor-patient/[patientId].tsx (tab Consultas)
 * - consultation-summary/[requestId].tsx
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { spacing, borderRadius, typography } from '../../lib/themeDoctor';
import { showToast } from '../ui/Toast';
import {
  type AnamnesisData,
  type FieldSeverity,
  ANA_FIELDS,
  ANA_FIELDS_COMPACT,
  displayFieldValue,
  displayMedicamento,
  displayExame,
  anamnesisToText,
} from '../../lib/domain/anamnesis';

interface AnamnesisCardProps {
  data: AnamnesisData;
  compact?: boolean;
  showAlerts?: boolean;
  showMedsSuggestions?: boolean;
  showExamsSuggestions?: boolean;
  showCopyButton?: boolean;
  style?: object;
}

function severityColor(severity: FieldSeverity, colors: DesignColors): string {
  switch (severity) {
    case 'danger': return colors.error;
    case 'warning': return colors.warning;
    case 'success': return colors.success;
    case 'info': return colors.primaryLight;
    default: return colors.textMuted;
  }
}

export function AnamnesisCard({
  data,
  compact = false,
  showAlerts = true,
  showMedsSuggestions = false,
  showExamsSuggestions = false,
  showCopyButton = true,
  style,
}: AnamnesisCardProps) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const S = useMemo(() => makeStyles(colors), [colors]);
  const fields = compact ? ANA_FIELDS_COMPACT : ANA_FIELDS;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(anamnesisToText(data, fields));
    showToast({ message: 'Anamnese copiada', type: 'success' });
  };

  const meds = data.medicamentos_sugeridos ?? [];
  const exams = data.exames_sugeridos ?? [];
  const alerts = data.alertas_vermelhos ?? [];
  const gravidade = data.classificacao_gravidade;

  return (
    <View style={[S.card, style]}>
      {/* Header */}
      <View style={S.header}>
        <View style={S.headerLeft}>
          <View style={S.headerIconWrap}>
            <Ionicons name="document-text" size={16} color={colors.primary} />
          </View>
          <Text style={S.headerTitle}>ANAMNESE ESTRUTURADA</Text>
          <View style={S.iaBadge}>
            <Ionicons name="sparkles" size={10} color={colors.primary} />
            <Text style={S.iaBadgeText}>IA</Text>
          </View>
        </View>
        {showCopyButton && (
          <TouchableOpacity
            onPress={handleCopy}
            style={S.copyBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Copiar anamnese"
          >
            <Ionicons name="copy-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Disclaimer */}
      <View style={S.disclaimer}>
        <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
        <Text style={S.disclaimerText}>
          Gerado por IA — revisão médica obrigatória. CFM Res. 2.299/2021.
        </Text>
      </View>

      {/* Gravidade badge */}
      {gravidade && (
        <View style={[S.gravidadeBadge, { backgroundColor: gravidadeColor(gravidade, colors) + '20' }]}>
          <View style={[S.gravidadeDot, { backgroundColor: gravidadeColor(gravidade, colors) }]} />
          <Text style={[S.gravidadeText, { color: gravidadeColor(gravidade, colors) }]}>
            {gravidadeLabel(gravidade)}
          </Text>
        </View>
      )}

      {/* Fields */}
      {fields.map(({ key, label, icon, severity }) => {
        const val = data[key];
        const display = displayFieldValue(val);
        if (!display) return null;

        const isAlert = key === 'alergias';
        const fieldColor = severityColor(severity, colors);

        return (
          <View key={key} style={S.field}>
            <View style={S.fieldLabelRow}>
              <View style={[S.fieldIconWrap, { backgroundColor: fieldColor + '18' }]}>
                <Ionicons name={icon} size={12} color={fieldColor} />
              </View>
              <Text style={[S.fieldLabel, isAlert && { color: colors.error }]}>{label}</Text>
            </View>
            <Text style={[
              S.fieldValue,
              key === 'cid_sugerido' && { color: colors.primary, fontFamily: typography.fontFamily.bold },
            ]}>
              {display}
            </Text>
          </View>
        );
      })}

      {/* Red flags */}
      {showAlerts && alerts.length > 0 && (
        <View style={S.alertsBlock}>
          <View style={S.fieldLabelRow}>
            <Ionicons name="alert-circle" size={14} color={colors.error} />
            <Text style={[S.fieldLabel, { color: colors.error }]}>ALERTAS DE GRAVIDADE</Text>
          </View>
          {alerts.map((a, i) => (
            <View key={i} style={S.alertItem}>
              <View style={S.alertBullet} />
              <Text style={S.alertText}>{a}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Medicamentos sugeridos */}
      {showMedsSuggestions && meds.length > 0 && (
        <View style={S.suggestionsSection}>
          <Text style={S.suggestionsLabel}>MEDICAMENTOS SUGERIDOS</Text>
          <View style={S.chipsRow}>
            {meds.map((m, i) => (
              <TouchableOpacity
                key={i}
                style={S.chip}
                onPress={async () => {
                  await Clipboard.setStringAsync(displayMedicamento(m));
                  showToast({ message: 'Copiado!', type: 'success' });
                }}
                activeOpacity={0.7}
              >
                <Text style={S.chipText} numberOfLines={2}>{displayMedicamento(m)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Exames sugeridos */}
      {showExamsSuggestions && exams.length > 0 && (
        <View style={S.suggestionsSection}>
          <Text style={S.suggestionsLabel}>EXAMES SUGERIDOS</Text>
          <View style={S.chipsRow}>
            {exams.map((e, i) => (
              <TouchableOpacity
                key={i}
                style={[S.chip, S.chipExam]}
                onPress={async () => {
                  await Clipboard.setStringAsync(displayExame(e));
                  showToast({ message: 'Copiado!', type: 'success' });
                }}
                activeOpacity={0.7}
              >
                <Text style={[S.chipText, S.chipExamText]} numberOfLines={2}>{displayExame(e)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function gravidadeColor(g: string, colors: DesignColors): string {
  switch (g) {
    case 'vermelho': return colors.error;
    case 'laranja': return colors.warning;
    case 'amarelo': return colors.warningYellow;
    case 'verde': return colors.success;
    default: return colors.textMuted;
  }
}

function gravidadeLabel(g: string): string {
  switch (g) {
    case 'vermelho': return 'Gravidade alta';
    case 'laranja': return 'Gravidade moderada-alta';
    case 'amarelo': return 'Gravidade moderada';
    case 'verde': return 'Baixa gravidade';
    default: return g;
  }
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    headerIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 12,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.8,
      flex: 1,
    },
    iaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
    },
    iaBadgeText: {
      fontSize: 11,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
      color: colors.primary,
    },
    copyBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    disclaimer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: spacing.md,
      paddingVertical: 4,
      paddingHorizontal: 8,
      backgroundColor: colors.primaryGhost,
      borderRadius: 6,
    },
    disclaimerText: {
      fontSize: 11,
      fontFamily: typography.fontFamily.regular,
      color: colors.textMuted,
      fontStyle: 'italic',
      flex: 1,
    },
    gravidadeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: borderRadius.pill,
      alignSelf: 'flex-start',
      marginBottom: spacing.md,
    },
    gravidadeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    gravidadeText: {
      fontSize: 12,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
    },
    field: {
      marginBottom: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    fieldLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    fieldIconWrap: {
      width: 22,
      height: 22,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldLabel: {
      fontSize: 11,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    fieldValue: {
      fontSize: 14,
      fontFamily: typography.fontFamily.regular,
      color: colors.text,
      lineHeight: 21,
      paddingLeft: 28,
    },
    alertsBlock: {
      marginTop: spacing.xs,
      padding: spacing.sm,
      backgroundColor: colors.errorLight,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.error,
    },
    alertItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingVertical: 3,
      paddingLeft: 28,
    },
    alertBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.error,
      marginTop: 6,
    },
    alertText: {
      fontSize: 13,
      fontFamily: typography.fontFamily.medium,
      fontWeight: '500',
      color: colors.error,
      lineHeight: 20,
      flex: 1,
    },
    suggestionsSection: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    suggestionsLabel: {
      fontSize: 11,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: colors.success,
      borderRadius: 20,
    },
    chipText: {
      fontSize: 12,
      fontFamily: typography.fontFamily.medium,
      fontWeight: '500',
      color: colors.white,
    },
    chipExam: {
      backgroundColor: colors.info,
    },
    chipExamText: {
      color: colors.white,
    },
  });
}
