import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../lib/theme';
import { StatusBadge } from './StatusBadge';
import { getDisplayPrice } from '../lib/config/pricing';
import { RequestResponseDto } from '../types/database';

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  high: { label: 'Alto Risco', color: '#DC2626', bg: '#FEE2E2', icon: 'alert-circle' },
  medium: { label: 'Risco Médio', color: '#D97706', bg: '#FEF3C7', icon: 'warning' },
  low: { label: 'Baixo Risco', color: '#059669', bg: '#D1FAE5', icon: 'shield-checkmark' },
};

const TYPE_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  prescription: { icon: 'document-text', color: '#0EA5E9', bg: '#E0F2FE', label: 'Receita' },
  exam: { icon: 'flask', color: '#8B5CF6', bg: '#EDE9FE', label: 'Exame' },
  consultation: { icon: 'videocam', color: '#10B981', bg: '#D1FAE5', label: 'Consulta' },
};

const FALLBACK_TYPE = { icon: 'document' as keyof typeof Ionicons.glyphMap, color: '#0EA5E9', bg: '#E0F2FE', label: 'Solicitação' };

function getRequestSubtitle(request: RequestResponseDto, showPatientName?: boolean): string {
  if (showPatientName && request.patientName) {
    return request.patientName;
  }
  const date = new Date(request.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  if (request.doctorName) {
    return `Dr(a). ${request.doctorName} • ${date}`;
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
    return request.symptoms.length > 40 ? request.symptoms.slice(0, 40) + '…' : request.symptoms;
  }
  return null;
}

interface Props {
  request: RequestResponseDto;
  onPress: () => void;
  showPatientName?: boolean;
}

export default function RequestCard({ request, onPress, showPatientName }: Props) {
  const typeConf = TYPE_CONFIG[request.requestType] || FALLBACK_TYPE;
  const preview = getMedicationPreview(request);
  const price = getDisplayPrice(request.price, request.requestType);
  const riskConf = request.aiRiskLevel ? RISK_CONFIG[request.aiRiskLevel] : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {/* Left accent strip */}
      <View style={[styles.accentStrip, { backgroundColor: typeConf.color }]} />

      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: typeConf.bg }]}>
        <Ionicons name={typeConf.icon} size={22} color={typeConf.color} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{typeConf.label}</Text>
          <StatusBadge status={request.status} size="sm" />
        </View>

        <Text style={styles.subtitle} numberOfLines={1}>{getRequestSubtitle(request, showPatientName)}</Text>

        {preview && (
          <Text style={styles.preview} numberOfLines={1}>💊 {preview}</Text>
        )}

        <View style={styles.bottomRow}>
          {riskConf && (
            <View style={[styles.riskBadge, { backgroundColor: riskConf.bg }]}>
              <Ionicons name={riskConf.icon} size={10} color={riskConf.color} />
              <Text style={[styles.riskText, { color: riskConf.color }]}>{riskConf.label}</Text>
            </View>
          )}
          <View style={styles.spacer} />
          {price > 0 && (
            <Text style={styles.price}>R$ {price.toFixed(2)}</Text>
          )}
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginHorizontal: spacing.md,
    marginBottom: 10,
    overflow: 'hidden',
    ...shadows.card,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  accentStrip: {
    width: 4,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginRight: 12,
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  preview: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  chevron: {
    marginLeft: 6,
  },
});
