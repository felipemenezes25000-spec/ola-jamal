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
  const displayValue = value;
  const styles = createStyles(colors, shadows);

  const content = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: softBg }]}>
        <Ionicons name={icon} size={22} color={resolvedIconColor} />
      </View>
      <Text style={styles.value}>{displayValue}</Text>
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
  colors: {
    surface: string;
    text: string;
    textMuted: string;
  },
  shadows: {
    card: object;
  }
) => StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 85,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    ...shadows.card,
    elevation: 2,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
    lineHeight: 28,
    minHeight: 28,
  },
  label: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    minHeight: 28,
    letterSpacing: 0.2,
    lineHeight: 16,
  },
});
