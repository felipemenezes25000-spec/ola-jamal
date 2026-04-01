import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../lib/designSystem';
import { RequestResponseDto } from '../../types/database';
import { getRequestUiState } from '../../lib/domain/getRequestUiState';

// ── Type config: icon, background, icon color ──
const TYPE_CONFIG: Record<string, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  iconColor: string;
}> = {
  prescription: {
    label: 'Receita',
    icon: 'clipboard-outline',
    bg: '#DBEAFE',       // blue-100
    iconColor: '#2563EB', // blue-600
  },
  exam: {
    label: 'Exame',
    icon: 'ribbon-outline',
    bg: '#DCFCE7',       // green-100
    iconColor: '#16A34A', // green-600
  },
  consultation: {
    label: 'Consulta',
    icon: 'videocam-outline',
    bg: '#EDE9FE',       // purple-100
    iconColor: '#7C3AED', // purple-600
  },
};

const FALLBACK_TYPE = {
  label: 'Pedido',
  icon: 'document-outline' as keyof typeof Ionicons.glyphMap,
  bg: '#F1F5F9',
  iconColor: '#64748B',
};

// ── Status badge colors matching design spec ──
type StatusStyleDef = {
  bg: string;
  text: string;
  hasPulse?: boolean;
  borderColor?: string;
};

function getStatusStyle(colorKey: string, uiState: string): StatusStyleDef {
  switch (uiState) {
    case 'in_consultation':
      return { bg: '#F0FDF4', text: '#15803D', hasPulse: true, borderColor: '#22C55E' };
    case 'needs_action':
      return { bg: '#FFFBEB', text: '#78350F', borderColor: undefined };
    case 'ready':
      return { bg: '#DBEAFE', text: '#1E40AF', borderColor: undefined };
    case 'historical':
    default:
      return { bg: '#F0FDF4', text: '#166534', borderColor: undefined };
  }
}

// ── Time helper ──
function timeWaiting(createdAt: string | null | undefined): string {
  if (createdAt == null || String(createdAt).trim() === '') return '';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

// ── Preview text ──
function getPreviewText(request: RequestResponseDto): string | null {
  const typeLabel = TYPE_CONFIG[request.requestType]?.label ?? 'Pedido';
  if (request.requestType === 'prescription' && request.medications?.length) {
    return `${typeLabel} \u00B7 ${request.medications[0]}`;
  }
  if (request.requestType === 'exam' && request.exams?.length) {
    return `${typeLabel} \u00B7 ${request.exams[0]}`;
  }
  if (request.requestType === 'consultation' && request.symptoms) {
    const sym = request.symptoms.length > 40 ? request.symptoms.slice(0, 40) + '\u2026' : request.symptoms;
    return `${typeLabel} \u00B7 ${sym}`;
  }
  return typeLabel;
}

// ── Pulsing dot for active consultation ──
function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.pulsingDot,
        { opacity },
      ]}
    />
  );
}

// ── Main component ──
interface QueueItemProps {
  request: RequestResponseDto;
  onPress: () => void;
  colors: DesignColors;
}

export const QueueItem = React.memo(function QueueItem({
  request, onPress, colors,
}: QueueItemProps) {
  const { label, colorKey, uiState } = getRequestUiState(request);
  const typeConf = TYPE_CONFIG[request.requestType] ?? FALLBACK_TYPE;
  const preview = getPreviewText(request);
  const time = timeWaiting(request.createdAt);
  const statusStyle = getStatusStyle(colorKey, uiState);
  const isActiveConsultation = uiState === 'in_consultation';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isActiveConsultation && styles.cardActiveConsultation,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Atender ${request.patientName ?? 'paciente'} \u2014 ${typeConf.label}`}
    >
      {/* Type icon */}
      <View style={[styles.typeIcon, { backgroundColor: typeConf.bg }]}>
        <Ionicons name={typeConf.icon} size={20} color={typeConf.iconColor} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Top row: patient name + status badge */}
        <View style={styles.topRow}>
          <Text style={styles.patientName} numberOfLines={1}>
            {request.patientName || 'Paciente'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            {statusStyle.hasPulse && <PulsingDot />}
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {label}
            </Text>
          </View>
        </View>

        {/* Description line */}
        {preview != null && (
          <Text style={styles.previewText} numberOfLines={1}>
            {preview}
          </Text>
        )}

        {/* Time */}
        {time !== '' && (
          <Text style={styles.timeText}>{time}</Text>
        )}
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color="#CBD5E1"
        style={styles.chevron}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardActiveConsultation: {
    borderColor: '#22C55E',
    borderWidth: 1.5,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },

  // Type icon
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },

  // Content
  content: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  patientName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
    flex: 1,
    minWidth: 0,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    gap: 5,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },

  // Description
  previewText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748B',
    marginBottom: 2,
    lineHeight: 16,
  },

  // Time
  timeText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94A3B8',
  },

  chevron: {
    marginLeft: 8,
    flexShrink: 0,
  },
});
