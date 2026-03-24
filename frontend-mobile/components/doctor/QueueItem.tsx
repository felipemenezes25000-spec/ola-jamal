import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../lib/designSystem';
import { RequestResponseDto } from '../../types/database';
import { getRequestUiState } from '../../lib/domain/getRequestUiState';

const TYPE_LABELS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  prescription: { label: 'Receita', icon: 'document-text' },
  exam: { label: 'Exame', icon: 'flask' },
  consultation: { label: 'Consulta', icon: 'videocam' },
};

function timeWaiting(createdAt: string | null | undefined): string {
  if (createdAt == null || String(createdAt).trim() === '') return '—';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function getPreviewText(request: RequestResponseDto): string | null {
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
    return request.symptoms.length > 50 ? request.symptoms.slice(0, 50) + '…' : request.symptoms;
  }
  return null;
}

interface QueueItemProps {
  request: RequestResponseDto;
  onPress: () => void;
  colors: DesignColors;
}

export const QueueItem = React.memo(function QueueItem({
  request, onPress, colors,
}: QueueItemProps) {
  const { label, colorKey } = getRequestUiState(request);
  const isHighRisk = request.aiRiskLevel === 'high';
  const typeConf = TYPE_LABELS[request.requestType] ?? { label: 'Pedido', icon: 'document' as keyof typeof Ionicons.glyphMap };
  const preview = getPreviewText(request);

  const statusColor = colorKey === 'action'
    ? colors.info
    : colorKey === 'success'
    ? colors.success
    : colorKey === 'waiting'
    ? colors.warning
    : colors.textMuted;

  const accentColor = isHighRisk
    ? colors.error
    : colorKey === 'action'
    ? colors.primary
    : colorKey === 'success'
    ? colors.success
    : colors.primary;

  const initials = useMemo(
    () => (request.patientName || 'P')
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join(''),
    [request.patientName]
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isHighRisk ? colors.error + '30' : colors.borderLight,
          shadowColor: colors.black,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Atender ${request.patientName ?? 'paciente'} — ${typeConf.label}`}
    >
      {/* Accent strip */}
      <View style={[styles.strip, { backgroundColor: accentColor }]} />

      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: accentColor + '15' }]}>
        <Text style={[styles.avatarText, { color: accentColor }]}>{initials}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Top: type + risk */}
        <View style={styles.topRow}>
          <View style={[styles.typePill, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={typeConf.icon} size={10} color={colors.primary} />
            <Text style={[styles.typeLabel, { color: colors.primary }]}>{typeConf.label}</Text>
          </View>
          {isHighRisk && (
            <View style={[styles.riskPill, { backgroundColor: colors.errorLight }]}>
              <Ionicons name="alert-circle" size={10} color={colors.error} />
              <Text style={[styles.riskLabel, { color: colors.error }]}>Alto</Text>
            </View>
          )}
          <View style={styles.spacer} />
          <Ionicons name="time-outline" size={11} color={colors.textMuted} />
          <Text style={[styles.timeLabel, { color: colors.textMuted }]}>
            {timeWaiting(request.createdAt)}
          </Text>
        </View>

        {/* Patient name */}
        <Text style={[styles.patientName, { color: colors.text }]} numberOfLines={1}>
          {request.patientName || 'Paciente'}
        </Text>

        {/* Preview text (medications, exams, symptoms) */}
        {preview && (
          <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
            {preview}
          </Text>
        )}

        {/* Status row */}
        <View style={styles.bottomRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{label}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 8,
    marginHorizontal: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  strip: {
    width: 3,
    alignSelf: 'stretch',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginRight: 10,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  riskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  riskLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  spacer: { flex: 1 },
  timeLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 2,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  preview: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 5,
    lineHeight: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  chevron: {
    marginRight: 12,
    marginLeft: 4,
    flexShrink: 0,
  },
});
