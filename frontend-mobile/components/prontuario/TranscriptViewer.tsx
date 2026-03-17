/**
 * TranscriptViewer — Exibe a transcrição da consulta formatada como conversa.
 * Parseia o texto cru do backend (prefixos [Médico]/[Paciente]) e renderiza
 * em formato de chat com balões, cores por speaker, e visual profissional.
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { spacing, borderRadius, typography } from '../../lib/themeDoctor';
import { showToast } from '../ui/Toast';

interface TranscriptSegment {
  speaker: 'medico' | 'paciente' | 'sistema';
  text: string;
  index: number;
}

/**
 * Parseia o texto cru da transcrição em segmentos por speaker.
 * Formato esperado: "[Médico] texto [Paciente] texto [Médico] texto..."
 * Agrupa mensagens consecutivas do mesmo speaker.
 */
function parseTranscript(raw: string): TranscriptSegment[] {
  if (!raw?.trim()) return [];

  const regex = /\[(Médico|Paciente|Transcrição)\]\s*/gi;
  const segments: TranscriptSegment[] = [];
  let lastIndex = 0;
  let lastSpeaker: 'medico' | 'paciente' | 'sistema' = 'sistema';
  let match: RegExpExecArray | null;
  let idx = 0;

  // Texto antes do primeiro marcador
  const firstMatch = regex.exec(raw);
  if (!firstMatch) {
    return [{ speaker: 'sistema', text: raw.trim(), index: 0 }];
  }

  if (firstMatch.index > 0) {
    const pre = raw.substring(0, firstMatch.index).trim();
    if (pre) segments.push({ speaker: 'sistema', text: pre, index: idx++ });
  }

  const speakerMap: Record<string, 'medico' | 'paciente' | 'sistema'> = {
    'médico': 'medico', 'medico': 'medico',
    'paciente': 'paciente',
    'transcrição': 'sistema', 'transcricao': 'sistema',
  };

  lastSpeaker = speakerMap[firstMatch[1].toLowerCase()] ?? 'sistema';
  lastIndex = firstMatch.index + firstMatch[0].length;
  regex.lastIndex = lastIndex;

  while ((match = regex.exec(raw)) !== null) {
    const text = raw.substring(lastIndex, match.index).trim();
    if (text) {
      // Agrupar com segmento anterior se mesmo speaker
      if (segments.length > 0 && segments[segments.length - 1].speaker === lastSpeaker) {
        segments[segments.length - 1].text += ' ' + text;
      } else {
        segments.push({ speaker: lastSpeaker, text, index: idx++ });
      }
    }
    lastSpeaker = speakerMap[match[1].toLowerCase()] ?? 'sistema';
    lastIndex = match.index + match[0].length;
  }

  // Texto após último marcador
  const remaining = raw.substring(lastIndex).trim();
  if (remaining) {
    if (segments.length > 0 && segments[segments.length - 1].speaker === lastSpeaker) {
      segments[segments.length - 1].text += ' ' + remaining;
    } else {
      segments.push({ speaker: lastSpeaker, text: remaining, index: idx++ });
    }
  }

  return segments;
}

interface TranscriptViewerProps {
  transcript: string;
  style?: object;
}

export function TranscriptViewer({ transcript, style }: TranscriptViewerProps) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const S = useMemo(() => makeStyles(colors), [colors]);
  const segments = useMemo(() => parseTranscript(transcript), [transcript]);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = useCallback(async () => {
    // Copia formatado com quebras de linha entre speakers
    const formatted = segments
      .map(s => {
        const label = s.speaker === 'medico' ? 'Médico' : s.speaker === 'paciente' ? 'Paciente' : 'Sistema';
        return `[${label}]\n${s.text}`;
      })
      .join('\n\n');
    await Clipboard.setStringAsync(formatted);
    showToast({ message: 'Transcrição copiada', type: 'success' });
  }, [segments]);

  if (!segments.length) return null;

  const visibleSegments = expanded ? segments : segments.slice(0, 6);
  const hasMore = segments.length > 6;

  return (
    <View style={[S.card, style]}>
      {/* Header */}
      <View style={S.header}>
        <View style={S.headerLeft}>
          <View style={S.headerIconWrap}>
            <Ionicons name="mic" size={16} color={colors.primary} />
          </View>
          <Text style={S.headerTitle}>TRANSCRIÇÃO DA CONSULTA</Text>
          <View style={S.countBadge}>
            <Text style={S.countBadgeText}>{segments.length} trechos</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleCopy} style={S.copyBtn} hitSlop={8}>
          <Ionicons name="copy-outline" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Disclaimer */}
      <View style={S.disclaimer}>
        <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
        <Text style={S.disclaimerText}>
          Transcrição automática — pode conter imprecisões.
        </Text>
      </View>

      {/* Segments */}
      {visibleSegments.map((seg, i) => {
        const isDoc = seg.speaker === 'medico';
        const isPat = seg.speaker === 'paciente';
        return (
          <View
            key={seg.index}
            style={[
              S.bubble,
              isDoc && S.bubbleDoc,
              isPat && S.bubblePat,
              !isDoc && !isPat && S.bubbleSys,
            ]}
          >
            <View style={S.bubbleHeader}>
              <View style={[S.speakerDot, isDoc && S.dotDoc, isPat && S.dotPat]} />
              <Text style={[S.speakerLabel, isDoc && S.labelDoc, isPat && S.labelPat]}>
                {isDoc ? 'Médico' : isPat ? 'Paciente' : 'Sistema'}
              </Text>
              <Text style={S.segIndex}>#{i + 1}</Text>
            </View>
            <Text style={S.bubbleText}>{seg.text}</Text>
          </View>
        );
      })}

      {/* Expand/collapse */}
      {hasMore && (
        <TouchableOpacity style={S.expandBtn} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
          <Text style={S.expandText}>
            {expanded ? 'Recolher' : `Ver todos (${segments.length} trechos)`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderLeftWidth: 4,
      borderLeftColor: colors.textMuted,
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
      width: 28, height: 28, borderRadius: 8,
      backgroundColor: colors.primarySoft,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 12, fontFamily: typography.fontFamily.bold,
      fontWeight: '700', color: colors.text, letterSpacing: 0.8,
    },
    countBadge: {
      backgroundColor: colors.primarySoft, borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 2,
    },
    countBadgeText: {
      fontSize: 11, fontFamily: typography.fontFamily.bold,
      fontWeight: '700', color: colors.primary,
    },
    copyBtn: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    disclaimer: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      marginBottom: spacing.md, paddingVertical: 4, paddingHorizontal: 8,
      backgroundColor: colors.primaryGhost, borderRadius: 6,
    },
    disclaimerText: {
      fontSize: 11, fontFamily: typography.fontFamily.regular,
      color: colors.textMuted, fontStyle: 'italic', flex: 1,
    },
    bubble: {
      marginBottom: 8, padding: 12, borderRadius: 12,
      borderWidth: 1,
    },
    bubbleDoc: {
      backgroundColor: '#EFF6FF', borderColor: '#BFDBFE',
      marginRight: 24,
    },
    bubblePat: {
      backgroundColor: '#F0FDF4', borderColor: '#BBF7D0',
      marginLeft: 24,
    },
    bubbleSys: {
      backgroundColor: '#F9FAFB', borderColor: '#E5E7EB',
    },
    bubbleHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
    },
    speakerDot: {
      width: 8, height: 8, borderRadius: 4, backgroundColor: '#9CA3AF',
    },
    dotDoc: { backgroundColor: '#3B82F6' },
    dotPat: { backgroundColor: '#22C55E' },
    speakerLabel: {
      fontSize: 11, fontFamily: typography.fontFamily.bold,
      fontWeight: '700', color: '#6B7280', textTransform: 'uppercase',
      letterSpacing: 0.5, flex: 1,
    },
    labelDoc: { color: '#1D4ED8' },
    labelPat: { color: '#16A34A' },
    segIndex: {
      fontSize: 10, color: '#9CA3AF',
      fontFamily: typography.fontFamily.regular,
    },
    bubbleText: {
      fontSize: 14, fontFamily: typography.fontFamily.regular,
      color: colors.text, lineHeight: 22,
    },
    expandBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 10, marginTop: 4,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primarySoft,
    },
    expandText: {
      fontSize: 13, fontFamily: typography.fontFamily.semibold,
      fontWeight: '600', color: colors.primary,
    },
  });
}
