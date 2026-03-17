/**
 * ClinicalOverviewTab — Visão geral do prontuário.
 *
 * Condições clínicas, medicamentos ativos, plano de cuidado,
 * resumo narrativo IA e insights da Dra. Renoveja.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { spacing, borderRadius, typography } from '../../lib/themeDoctor';
import { SectionCard, Disclaimer } from './shared';
import type { PatientClinicalSummaryStructured } from '../../lib/api';

interface ClinicalOverviewTabProps {
  structured: PatientClinicalSummaryStructured | null;
  narrativeSummary: string | null;
  summaryLoading: boolean;
  consultationCount: number;
  allergies: string[];
  lastConsultationDays?: number;
}

export function ClinicalOverviewTab({
  structured,
  narrativeSummary,
  summaryLoading,
  consultationCount,
  allergies,
  lastConsultationDays,
}: ClinicalOverviewTabProps) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const S = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={S.container}>
      {/* Problem list */}
      {structured?.problemList && structured.problemList.length > 0 && (
        <SectionCard
          icon="list"
          iconBg={colors.infoLight}
          iconColor={colors.info}
          title="Condições clínicas"
          borderColor={colors.info}
          
        >
          <View style={S.chipList}>
            {structured.problemList.map((p, i) => (
              <View key={i} style={S.chip}>
                <Text style={S.chipText}>{p}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      )}

      {/* Active medications */}
      {structured?.activeMedications && structured.activeMedications.length > 0 && (
        <SectionCard
          icon="medical"
          iconBg={colors.primarySoft}
          iconColor={colors.primary}
          title="Medicamentos em uso"
          borderColor={colors.primary}
          
        >
          {structured.activeMedications.map((m, i) => (
            <View key={i} style={S.medItem}>
              <View style={S.medBullet}>
                <Text style={S.medBulletText}>{i + 1}</Text>
              </View>
              <Text style={S.medText}>{m}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {/* Narrative summary */}
      <SectionCard
        icon="document-text"
        iconBg={colors.accentSoft}
        iconColor={colors.primaryLight}
        title="Resumo narrativo"
        subtitle="Visão consolidada de consultas, receitas e exames"
        borderColor={colors.primaryLight}
        
      >
        {summaryLoading ? (
          <View style={S.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={S.loadingText}>Gerando resumo...</Text>
          </View>
        ) : (structured?.narrativeSummary ?? narrativeSummary) ? (
          <Text style={S.bodyText}>{structured?.narrativeSummary ?? narrativeSummary}</Text>
        ) : (
          <Text style={S.emptyText}>
            Resumo indisponível. Use as abas para revisar o histórico completo.
          </Text>
        )}
        <Disclaimer text="Resumo de apoio. O médico decide com base na avaliação clínica." />
      </SectionCard>

      {/* Dra. Renoveja insights */}
      <View style={S.draCard}>
        <View style={S.draHeader}>
          <View style={S.draAvatar}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.draLabel}>DRA. RENOVEJA</Text>
            <Text style={S.draSub}>Insights e sugestões de apoio</Text>
          </View>
        </View>
        <View style={S.draContent}>
          {consultationCount === 0 ? (
            <Text style={S.draText}>
              Este paciente ainda não realizou consultas. Quando houver histórico, posso sugerir pontos de atenção e evolução.
            </Text>
          ) : (
            <>
              <Text style={S.draText}>
                Histórico com {consultationCount} consulta(s).
                {lastConsultationDays != null && lastConsultationDays > 0
                  ? ` Última consulta há ${lastConsultationDays} dia(s).`
                  : ''}
                {' '}Use a aba Consultas para visão contínua: queixa, evolução, CID e conduta.
              </Text>
              {allergies.length > 0 && (
                <View style={S.draAlert}>
                  <Ionicons name="alert-circle" size={14} color={colors.error} />
                  <Text style={S.draAlertText}>
                    Atenção: alergias registradas — {allergies.slice(0, 3).join(', ')}{allergies.length > 3 ? '...' : ''}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
        <Disclaimer />
      </View>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: {
      gap: 0,
    },
    chipList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: borderRadius.pill,
    },
    chipText: {
      fontSize: 13,
      fontFamily: typography.fontFamily.medium,
      color: colors.primary,
    },
    medItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 6,
      gap: 10,
    },
    medBullet: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    medBulletText: {
      fontSize: 12,
      fontFamily: typography.fontFamily.bold,
      color: colors.primary,
    },
    medText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      lineHeight: 21,
    },
    bodyText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      fontStyle: 'italic',
      lineHeight: 21,
    },
    disclaimer: {
      fontSize: 12,
      color: colors.textMuted,
      fontStyle: 'italic',
      marginTop: spacing.md,
    },
    draCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderLeftWidth: 4,
      borderLeftColor: colors.primaryLight,
    },
    draHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    draAvatar: {
      width: 40,
      height: 40,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    draLabel: {
      fontSize: 12,
      fontFamily: typography.fontFamily.bold,
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    draSub: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    draContent: {
      marginTop: spacing.md,
    },
    draText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 21,
    },
    draAlert: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.sm,
      padding: spacing.sm,
      backgroundColor: colors.errorLight,
      borderRadius: borderRadius.sm,
    },
    draAlertText: {
      fontSize: 12,
      color: colors.error,
      fontWeight: '600',
      flex: 1,
    },
  });
}
