/**
 * VideoCallTopBar — Timer sincronizado + qualidade de conexão + badge IA.
 *
 * Countdown visual: normal → warning (2min) → critical (1min).
 * Oculto em Picture-in-Picture.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../../lib/designSystem';
import type { ConnectionQuality } from '../../../hooks/useDailyCall';

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function qLabel(q: ConnectionQuality) {
  return q === 'good' ? 'Boa' : q === 'poor' ? 'Instável' : q === 'bad' ? 'Ruim' : '...';
}

interface VideoCallTopBarProps {
  colors: DesignColors;
  topInset: number;
  quality: ConnectionQuality;
  callSeconds: number;
  contractedMinutes: number | null;
  isAiActive: boolean;
}

export const VideoCallTopBar = React.memo(function VideoCallTopBar({
  colors, topInset, quality, callSeconds, contractedMinutes, isAiActive,
}: VideoCallTopBarProps) {
  const qColor = quality === 'good' ? colors.success : quality === 'poor' ? colors.warning : quality === 'bad' ? colors.error : colors.textMuted;
  const rem = contractedMinutes ? Math.max(0, contractedMinutes * 60 - callSeconds) : null;
  const urgent = rem != null && rem <= 120;
  const critical = rem != null && rem <= 60;
  const timerStr = contractedMinutes ? `${fmt(callSeconds)} / ${fmt(contractedMinutes * 60)}` : fmt(callSeconds);

  return (
    <View style={[S.top, { paddingTop: topInset + 8 }]}>
      <View style={S.topL}>
        <View style={[S.qPill, { backgroundColor: `${qColor}22` }]}>
          <View style={[S.qDot, { backgroundColor: qColor }]} />
          <Text style={[S.qTxt, { color: qColor }]}>{qLabel(quality)}</Text>
        </View>
        {isAiActive && (
          <View style={S.aiPill}>
            <View style={[S.aiDot, { backgroundColor: colors.primary }]} />
            <Text style={[S.aiTxt, { color: colors.primary }]}>IA</Text>
          </View>
        )}
      </View>
      <View style={[
        S.tPill,
        urgent && S.tPillUrg,
        critical && { backgroundColor: colors.destructive },
      ]}>
        <Ionicons name="time-outline" size={14} color={critical ? colors.white : urgent ? colors.warning : colors.textMuted} />
        <Text
          allowFontScaling={false}
          style={[
            S.tTxt, { color: colors.text },
            urgent && { color: colors.warning },
            critical && { color: colors.white },
          ]}
        >
          {timerStr}
        </Text>
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  top: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 10, backgroundColor: 'rgba(15,23,42,0.92)', zIndex: 20,
  },
  topL: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  qPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  qDot: { width: 7, height: 7, borderRadius: 4 },
  qTxt: { fontSize: 12, fontWeight: '600' },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: 'rgba(44,177,255,0.15)' },
  aiDot: { width: 6, height: 6, borderRadius: 3 },
  aiTxt: { fontSize: 12, fontWeight: '700' },
  tPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: 'rgba(30,41,59,0.85)' },
  tPillUrg: { backgroundColor: 'rgba(251,191,36,0.4)' },
  tTxt: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
