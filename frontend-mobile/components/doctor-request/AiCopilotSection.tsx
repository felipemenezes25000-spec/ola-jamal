import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors, spacing, typography } from '../../lib/themeDoctor';
import { DoctorCard } from '../ui/DoctorCard';
import { AIActionSheet, type AIActionSheetAction } from '../ui';
import { showToast } from '../ui/Toast';
import { parseAiSummary } from '../FormattedAiSummary';
import { RequestResponseDto } from '../../types/database';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const RISK_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  low: { bg: colors.successLight, text: colors.success, icon: 'shield-checkmark' },
  medium: { bg: colors.warningLight, text: '#D97706', icon: 'alert-circle' },
  high: { bg: colors.errorLight, text: colors.destructive, icon: 'warning' },
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

function getRiskLabelPt(level: string | null | undefined): string {
  if (!level) return 'Risco não classificado';
  return RISK_LABELS_PT[level.toLowerCase()] ?? 'Risco não classificado';
}

function getUrgencyLabelPt(level: string | null | undefined): string {
  if (!level) return 'Não informado';
  return URGENCY_LABELS_PT[level.toLowerCase()] ?? 'Não informado';
}

export function hasUsefulAiContent(
  aiSummary: string | null | undefined,
  aiRisk?: string | null,
  aiUrgency?: string | null,
): boolean {
  if (aiRisk || aiUrgency) return true;
  if (!aiSummary || !aiSummary.trim()) return false;
  return aiSummary.replace(/\s/g, '').length > 50;
}

interface AiCopilotSectionProps {
  request: RequestResponseDto;
  expanded: boolean;
  onToggleExpand: () => void;
  style?: object;
}

export function AiCopilotSection({ request, expanded, onToggleExpand, style }: AiCopilotSectionProps) {
  if (!hasUsefulAiContent(request.aiSummaryForDoctor, request.aiRiskLevel, request.aiUrgency)) {
    return null;
  }

  const [sheetOpen, setSheetOpen] = useState(false);
  const summaryText = request.aiSummaryForDoctor?.trim() ?? '';
  const blocks = useMemo(() => parseAiSummary(summaryText), [summaryText]);
  const shouldTruncate = !expanded && blocks.length > 6;
  const displayBlocks = shouldTruncate ? blocks.slice(0, 6) : blocks;
  const sheetActions = useMemo<AIActionSheetAction[]>(() => {
    const actions: AIActionSheetAction[] = [
      {
        key: 'copy',
        label: 'Copiar resumo',
        icon: 'copy-outline',
        onPress: async () => {
          await Clipboard.setStringAsync(summaryText);
          showToast({ message: 'Copiado para a área de transferência', type: 'success' });
        },
      },
    ];
    if (blocks.length > 6) {
      actions.unshift({
        key: 'toggle-expand',
        label: expanded ? 'Ver menos' : 'Ver mais',
        icon: expanded ? 'chevron-up-outline' : 'chevron-down-outline',
        onPress: onToggleExpand,
      });
    }
    return actions;
  }, [blocks.length, expanded, onToggleExpand, summaryText]);

  return (
    <DoctorCard style={[style, s.aiCard]}>
      <View style={s.aiHeader}>
        <Ionicons name="sparkles" size={18} color={colors.primary} />
        <Text style={s.aiTitle}>Copiloto IA</Text>
        {request.aiRiskLevel && (
          <View style={[s.riskBadge, { backgroundColor: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.bg || colors.muted }]}>
            <Ionicons
              name={(RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.icon || 'alert-circle') as IoniconName}
              size={12}
              color={RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text}
            />
            <Text style={[s.riskText, { color: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text }]}>
              {getRiskLabelPt(request.aiRiskLevel)}
            </Text>
          </View>
        )}
      </View>

      <View style={s.aiDisclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
        <Text style={s.aiDisclaimerText}>Sugestões geradas por IA — decisão final do médico.</Text>
      </View>

      {summaryText.length > 0 && (
        <View style={s.aiSummarySection}>
          {displayBlocks.map((block, i) => {
            if (block.type === 'header') {
              return (
                <View key={i} style={[s.aiBlock, i > 0 && s.aiBlockSpaced]}>
                  <Text style={s.aiBlockHeader}>{block.header}</Text>
                  {block.content ? <Text style={s.aiBlockContent}>{block.content}</Text> : null}
                </View>
              );
            }
            if (block.type === 'bullet') {
              return (
                <View key={i} style={s.aiBulletRow}>
                  <View style={s.aiBulletDot} />
                  <Text style={s.aiBulletText}>{block.content}</Text>
                </View>
              );
            }
            return <Text key={i} style={s.aiBlockContent}>{block.content}</Text>;
          })}
          {shouldTruncate && <Text style={s.aiTruncatedHint}>...</Text>}
          <View style={s.aiSummaryActions}>
            <TouchableOpacity style={s.aiSummaryActionBtn} onPress={() => setSheetOpen(true)}>
              <Ionicons name="ellipsis-horizontal-circle-outline" size={16} color={colors.primary} />
              <Text style={s.aiSummaryActionText}>Ações</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {request.aiUrgency && (
        <View style={s.urgencyRow}>
          <Ionicons name="time" size={14} color={colors.textSecondary} />
          <Text style={s.urgencyText}>Urgência: {getUrgencyLabelPt(request.aiUrgency)}</Text>
        </View>
      )}
      <AIActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Ações do Copiloto IA"
        subtitle="Escolha como deseja usar este resumo."
        actions={sheetActions}
      />
    </DoctorCard>
  );
}

const s = StyleSheet.create({
  aiCard: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.accent },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  aiTitle: { fontSize: 13, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text, flex: 1, letterSpacing: 0.8 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
  riskText: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700' },
  aiDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(0,119,182,0.06)', borderRadius: 6 },
  aiDisclaimerText: { fontSize: 11, fontFamily: typography.fontFamily.regular, color: colors.textMuted, fontStyle: 'italic' },
  aiSummarySection: { marginBottom: spacing.sm },
  aiBlock: {},
  aiBlockSpaced: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,119,182,0.08)' },
  aiBlockHeader: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary, letterSpacing: 0.8, marginBottom: 4 },
  aiBlockContent: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 22 },
  aiBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4, paddingLeft: 2 },
  aiBulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
  aiBulletText: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 22 },
  aiTruncatedHint: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  aiSummaryActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,119,182,0.06)' },
  aiSummaryActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10 },
  aiSummaryActionText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  urgencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  urgencyText: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },
});
