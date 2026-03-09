import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, type AppThemeRole } from '../lib/ui/useAppTheme';

interface StatsCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | string;
  iconColor?: string;
  iconBgColor?: string;
  onPress?: () => void;
  role?: AppThemeRole;
}

export function StatsCard({
  icon,
  label,
  value,
  iconColor,
  iconBgColor,
  onPress,
  role,
}: StatsCardProps) {
  const { colors, shadows } = useAppTheme({ role });
  const resolvedIconColor = iconColor ?? colors.primary;
  const softBg = iconBgColor || (resolvedIconColor + '18');
  const styles = createStyles(colors, shadows);

  const content = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: softBg }]}>
        <Ionicons name={icon} size={20} color={resolvedIconColor} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={2} ellipsizeMode="tail">{label}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.card}>{content}</View>;
}

const createStyles = (
  colors: { surface: string; text: string; textMuted: string; borderLight: string },
  shadows: { card: object }
) => StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
    lineHeight: 26,
    minHeight: 26,
  },
  label: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    minHeight: 28,
    letterSpacing: 0.3,
    lineHeight: 14,
    paddingHorizontal: 2,
    alignSelf: 'stretch',
    textTransform: 'uppercase',
  },
});
