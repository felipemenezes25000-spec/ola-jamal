/**
 * VideoCallTopBar — "AO VIVO" indicator + elapsed timer pill + connection quality + AI badge.
 *
 * Dark-mode video overlay bar with immersive design.
 * Hidden in Picture-in-Picture.
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

function qIcon(q: ConnectionQuality): 'wifi' | 'wifi-outline' | 'warning-outline' | 'cloud-offline-outline' {
  return q === 'good' ? 'wifi' : q === 'poor' ? 'wifi-outline' : q === 'bad' ? 'warning-outline' : 'cloud-offline-outline';
}

interface VideoCallTopBarProps {
  colors: DesignColors;
  topInset: number;
  quality: ConnectionQuality;
  callSeconds: number;
  contractedMinutes: number | null;
  isAiActive: boolean;
  patientName?: string;
}

export const VideoCallTopBar = React.memo(function VideoCallTopBar({
  colors, topInset, quality, callSeconds, contractedMinutes, isAiActive, patientName,
}: VideoCallTopBarProps) {
  const qColor = quality === 'good' ? '#22C55E' : quality === 'poor' ? '#F59E0B' : quality === 'bad' ? '#EF4444' : '#94A3B8';
  const timerStr = fmt(callSeconds);

  return (
    <View style={[S.top, { paddingTop: topInset + 8 }]}>
      {/* Left section: AO VIVO + quality */}
      <View style={S.topL}>
        {/* AO VIVO indicator */}
        <View style={S.livePill}>
          <View style={S.liveDot} />
          <Text style={S.liveTxt}>AO VIVO</Text>
        </View>

        {/* Connection quality */}
        <View style={[S.qPill, { backgroundColor: `${qColor}22` }]}>
          <Ionicons name={qIcon(quality)} size={12} color={qColor} />
          <Text style={[S.qTxt, { color: qColor }]}>{qLabel(quality)}</Text>
        </View>
      </View>

      {/* Center: patient info (optional) */}
      {patientName ? (
        <View style={S.topC}>
          <Text style={S.patientName} numberOfLines={1}>{patientName}</Text>
        </View>
      ) : null}

      {/* Right section: Timer + AI badge */}
      <View style={S.topR}>
        {isAiActive && (
          <View style={S.aiPill}>
            <Ionicons name="sparkles" size={10} color="#8B5CF6" />
            <Text style={S.aiTxt}>IA</Text>
          </View>
        )}
        <View style={S.tPill}>
          <Ionicons name="time-outline" size={13} color="#94A3B8" />
          <Text allowFontScaling={false} style={S.tTxt}>{timerStr}</Text>
        </View>
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(11,17,32,0.88)',
    zIndex: 20,
  },
  topL: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flex: 1,
  },
  topC: {
    flex: 1,
    alignItems: 'center',
  },
  topR: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },

  // AO VIVO pill
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.5,
  },

  // Connection quality
  qPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  qTxt: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Patient name
  patientName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  // AI badge
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  aiTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B5CF6',
  },

  // Timer pill
  tPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(30,41,59,0.85)',
  },
  tTxt: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: 'rgba(255,255,255,0.9)',
  },
});
