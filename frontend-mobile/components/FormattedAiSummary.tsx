import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../lib/themeDoctor';

export interface AiSummaryBlock {
  type: 'header' | 'bullet' | 'text';
  header?: string;
  content: string;
}

/** Parses AI summary text into structured blocks for better readability */
export function parseAiSummary(text: string): AiSummaryBlock[] {
  const lines = text.split('\n').filter(l => l.trim());
  const blocks: AiSummaryBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Section header: 2+ uppercase words (including accented) followed by colon
    const headerMatch = trimmed.match(/^([A-ZÁÉÍÓÚÃÕÊÇÂÔ][A-ZÁÉÍÓÚÃÕÊÇÂÔ\s]{2,}):\s*(.*)/);
    if (headerMatch) {
      blocks.push({ type: 'header', header: headerMatch[1].trim(), content: headerMatch[2].trim() });
      continue;
    }
    // Bullet point
    if (trimmed.startsWith('•') || (trimmed.startsWith('- ') && !trimmed.startsWith('--'))) {
      blocks.push({ type: 'bullet', content: trimmed.replace(/^[•\-]\s*/, '') });
      continue;
    }
    blocks.push({ type: 'text', content: trimmed });
  }
  return blocks;
}

interface FormattedAiSummaryProps {
  text: string;
  /** Maximum number of blocks to show (truncates with "...") */
  maxBlocks?: number;
  /** Accent color for headers and bullet dots (defaults to primary blue) */
  accentColor?: string;
}

export function FormattedAiSummary({ text, maxBlocks, accentColor }: FormattedAiSummaryProps) {
  const blocks = parseAiSummary(text);
  const displayBlocks = maxBlocks && blocks.length > maxBlocks ? blocks.slice(0, maxBlocks) : blocks;
  const truncated = maxBlocks ? blocks.length > maxBlocks : false;
  const accent = accentColor || colors.primary;

  return (
    <View>
      {displayBlocks.map((block, i) => {
        if (block.type === 'header') {
          return (
            <View key={i} style={[styles.block, i > 0 && styles.blockSpaced]}>
              <Text style={[styles.blockHeader, { color: accent }]}>{block.header}</Text>
              {block.content ? <Text style={styles.blockContent}>{block.content}</Text> : null}
            </View>
          );
        }
        if (block.type === 'bullet') {
          return (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: accent }]} />
              <Text style={styles.bulletText}>{block.content}</Text>
            </View>
          );
        }
        return <Text key={i} style={styles.blockContent}>{block.content}</Text>;
      })}
      {truncated && <Text style={styles.truncatedHint}>...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {},
  blockSpaced: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  blockHeader: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  blockContent: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4, paddingLeft: 2 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 22 },
  truncatedHint: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
});
