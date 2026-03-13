import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors, DesignTokens } from '../lib/designSystem';
import { layout as dsLayout, borderRadius as dsBorderRadius } from '../lib/designSystem';
import { StatusBadge } from './StatusBadge';
import { getDisplayPrice } from '../lib/config/pricing';
import { formatBRL, formatDateBR } from '../lib/utils/format';
import { RequestResponseDto } from '../types/database';

function getRiskConfig(colors: DesignColors): Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> {
  return {
    high: { label: 'Risco alto', color: colors.error, bg: colors.errorLight, icon: 'alert-circle' },
    medium: { label: 'Risco médio', color: colors.warning, bg: colors.warningLight, icon: 'warning' },
    low: { label: 'Risco baixo', color: colors.success, bg: colors.successLight, icon: 'shield-checkmark' },
  };
}

function getTypeConfig(colors: DesignColors): Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> {
  return {
    prescription: { icon: 'document-text', color: colors.info, bg: colors.infoLight, label: 'Receita' },
    exam: { icon: 'flask', color: colors.textMuted, bg: colors.surfaceSecondary, label: 'Exame' },
    consultation: { icon: 'videocam', color: colors.success, bg: colors.successLight, label: 'Consulta' },
  };
}

function getRequestSubtitle(request: RequestResponseDto, showPatientName?: boolean): string {
  if (showPatientName && request.patientName) {
    return request.patientName;
  }
  const date = formatDateBR(request.createdAt, { short: true });
  if (request.doctorName) {
    return `Dr(a). ${request.doctorName} · ${date}`;
  }
  return date;
}

function getMedicationPreview(request: RequestResponseDto): string | null {
  if (request.requestType === 'prescription' && request.medications?.length) {
    const first = request.medications[0];
    const more = request.medications.length > 1 ? ` +${request.medications.length - 1}` : '';
    return first + more;
  }
  if (request.requestType === 'exam' && request.exams?.length) {
    const first = request.exams[0];
    const more = request.exams.length > 1 ? ` +${request.exams.length - 1}` : '';
    return first + more;
  }
  if (request.requestType === 'consultation' && request.symptoms) {
    return request.symptoms.length > 60 ? request.symptoms.slice(0, 60) + '…' : request.symptoms;
  }
  return null;
}

interface Props {
  request: RequestResponseDto;
  onPress: () => void;
  showPatientName?: boolean;
  showPrice?: boolean;
  showRisk?: boolean;
  suppressHorizontalMargin?: boolean;
  accessibilityLabel?: string;
}

function RequestCardInner({
  request,
  onPress,
  showPatientName,
  showPrice = false,
  showRisk = false,
  suppressHorizontalMargin = false,
  accessibilityLabel,
}: Props) {
  const { colors, shadows } = useAppTheme();
  const riskConfig = useMemo(() => getRiskConfig(colors), [colors]);
  const typeConfig = useMemo(() => getTypeConfig(colors), [colors]);
  const fallbackType = useMemo(() => ({ icon: 'document' as keyof typeof Ionicons.glyphMap, color: colors.info, bg: colors.infoLight, label: 'Solicitação' }), [colors]);
  const typeConf = typeConfig[request.requestType] || fallbackType;
  const preview = getMedicationPreview(request);
  const price = getDisplayPrice(request.price, request.requestType, request.prescriptionType ?? undefined);
  const riskConf = showRisk && request.aiRiskLevel ? riskConfig[request.aiRiskLevel] : null;
  const defaultLabel = `${typeConf.label}${request.patientName ? ` de ${request.patientName}` : ''}`;
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        suppressHorizontalMargin && styles.containerNoHorizontalMargin,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? defaultLabel}
    >
      {/* Ícone de tipo com fundo colorido */}
      <View style={[styles.iconContainer, { backgroundColor: typeConf.bg }]}>
        <Ionicons name={typeConf.icon} size={20} color={typeConf.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{typeConf.label}</Text>
          <StatusBadge status={request.status} size="sm" />
        </View>

        <Text style={styles.subtitle} numberOfLines={1}>{getRequestSubtitle(request, showPatientName)}</Text>

        {preview && (
          <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
        )}

        {(riskConf || (showPrice && price > 0)) && (
          <View style={styles.bottomRow}>
            {riskConf && (
              <View style={[styles.riskBadge, { backgroundColor: riskConf.bg }]}>
                <Ionicons name={riskConf.icon} size={10} color={riskConf.color} />
                <Text style={[styles.riskText, { color: riskConf.color }]}>{riskConf.label}</Text>
              </View>
            )}
            <View style={styles.spacer} />
            {showPrice && price > 0 && (
              <Text style={styles.price}>{formatBRL(price)}</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.chevronWrap}>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} importantForAccessibility="no" />
      </View>
    </Pressable>
  );
}

const RequestCard = React.memo(RequestCardInner, (prev, next) =>
  prev.request.id === next.request.id &&
  prev.request.status === next.request.status &&
  prev.request.updatedAt === next.request.updatedAt &&
  prev.showPatientName === next.showPatientName &&
  prev.showPrice === next.showPrice &&
  prev.showRisk === next.showRisk &&
  prev.suppressHorizontalMargin === next.suppressHorizontalMargin &&
  prev.accessibilityLabel === next.accessibilityLabel
);

export default RequestCard;

function makeStyles(colors: DesignColors, shadows: DesignTokens['shadows']) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: dsBorderRadius.card,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginHorizontal: dsLayout.screenPaddingHorizontal,
      marginBottom: 10,
      padding: 14,
      ...shadows.card,
    },
    containerNoHorizontalMargin: {
      marginHorizontal: 0,
    },
    pressed: {
      transform: [{ scale: 0.985 }],
      opacity: 0.92,
    },
    iconContainer: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      flexShrink: 0,
    },
    content: {
      flex: 1,
      minWidth: 0,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 3,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: 'PlusJakartaSans_700Bold',
      color: colors.text,
      letterSpacing: 0.1,
      marginRight: 8,
      flex: 1,
      minWidth: 0,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    preview: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textMuted,
      marginTop: 2,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },
    riskBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      gap: 3,
    },
    riskText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    spacer: { flex: 1 },
    price: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
    },
    chevronWrap: {
      marginLeft: 8,
      flexShrink: 0,
      justifyContent: 'center',
    },
  });
}
