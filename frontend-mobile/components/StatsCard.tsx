import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '../lib/themeDoctor';

interface StatsCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | string;
  iconColor?: string;
  iconBgColor?: string;
  onPress?: () => void;
}

export function StatsCard({
  icon,
  label,
  value,
  iconColor = colors.primary,
  iconBgColor,
  onPress,
}: StatsCardProps) {
  const softBg = iconBgColor || (iconColor + '18');
  const displayValue = value;

  const content = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: softBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.value}>{displayValue}</Text>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
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

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
    elevation: 6,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.88,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    minHeight: 28,
  },
});
