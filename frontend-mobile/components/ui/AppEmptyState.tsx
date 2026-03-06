import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';

type IconName = keyof typeof Ionicons.glyphMap;

interface AppEmptyStateProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function AppEmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: AppEmptyStateProps) {
  const { colors, typography, shadows } = useAppTheme();

  return (
    <View style={[s.container, style]}>
      <View style={[s.iconCircle, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={[s.title, { color: colors.text, fontFamily: typography.fontFamily.bold }]}>{title}</Text>
      {subtitle ? (
        <Text style={[s.subtitle, { color: colors.textSecondary, fontFamily: typography.fontFamily.regular }]}>
          {subtitle}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Pressable
          style={({ pressed }) => [
            s.actionBtn,
            { backgroundColor: colors.primary },
            (shadows as any)?.button,
            pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
          ]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[s.actionText, { color: colors.white, fontFamily: typography.fontFamily.bold }]}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.2, lineHeight: 24 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 16,
    marginTop: 12,
    minHeight: 44,
  },
  actionText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
});
