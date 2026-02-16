import React from 'react';
import { Text, StyleSheet, Pressable, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';

const MIN_TOUCH = 44;
const COMPACT_ICON_SECTION_HEIGHT = 52;
const COMPACT_ICON_GAP = 6;
const COMPACT_TEXT_SECTION_HEIGHT = 44;
const COMPACT_ICON_WRAPPER_SIZE = 48;
const COMPACT_CARD_PADDING_V = 8;
const COMPACT_LABEL_FONT_SIZE = 12;
const COMPACT_CARD_HEIGHT =
  COMPACT_CARD_PADDING_V * 2 + COMPACT_ICON_SECTION_HEIGHT + COMPACT_ICON_GAP + COMPACT_TEXT_SECTION_HEIGHT;

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  iconColor?: string;
  iconBgColor?: string;
  onPress: () => void;
  /** Layout compacto vertical para grid (sem scroll horizontal) */
  compact?: boolean;
}

export function ActionCard({
  icon,
  label,
  description,
  iconColor = theme.colors.primary.main,
  iconBgColor = theme.colors.primary.lighter,
  onPress,
  compact = false,
}: ActionCardProps) {
  const { width } = useWindowDimensions();
  const scale = Math.min(1.15, Math.max(0.9, width / 375));
  const iconSize = Math.round(28 * scale);
  const labelSize = Math.round(theme.typography.fontSize.md * scale);
  const descSize = Math.round(theme.typography.fontSize.sm * scale);

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [styles.container, styles.compactContainer, { opacity: pressed ? 0.8 : 1 }]}
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {/* Bloco superior fixo: ícone */}
        <View style={styles.compactIconSection}>
          <View style={[styles.compactIconCircle, { backgroundColor: iconBgColor }]}>
            <Ionicons name={icon} size={24} color={iconColor} />
          </View>
        </View>
        {/* Espaçamento fixo */}
        <View style={styles.compactIconTextGap} />
        {/* Bloco inferior fixo: texto (2 linhas reservadas, sem truncamento) */}
        <View style={styles.compactTextSection}>
          <Text style={[styles.label, styles.compactLabel, { fontSize: COMPACT_LABEL_FONT_SIZE }]}>
            {label}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.container, { opacity: pressed ? 0.8 : 1 }]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconBgColor, minWidth: MIN_TOUCH, minHeight: MIN_TOUCH }]}>
        <Ionicons name={icon} size={iconSize} color={iconColor} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.label, { fontSize: labelSize }]}>{label}</Text>
        {description && <Text style={[styles.description, { fontSize: descSize }]}>{description}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={Math.round(20 * scale)} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH,
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.borderRadius.card,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.card,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  description: {
    color: theme.colors.text.secondary,
  },
  compactContainer: {
    flex: 1,
    minWidth: 0,
    height: COMPACT_CARD_HEIGHT,
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: COMPACT_CARD_PADDING_V,
    paddingBottom: COMPACT_CARD_PADDING_V,
    paddingHorizontal: theme.spacing.xs,
    overflow: 'hidden',
  },
  compactIconSection: {
    height: COMPACT_ICON_SECTION_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactIconTextGap: {
    height: COMPACT_ICON_GAP,
    width: '100%',
  },
  compactTextSection: {
    height: COMPACT_TEXT_SECTION_HEIGHT,
    minHeight: COMPACT_TEXT_SECTION_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  compactIconCircle: {
    width: COMPACT_ICON_WRAPPER_SIZE,
    height: COMPACT_ICON_WRAPPER_SIZE,
    borderRadius: COMPACT_ICON_WRAPPER_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  compactLabel: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
