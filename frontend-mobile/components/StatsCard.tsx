import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';

const MIN_TOUCH = 44;
const CARD_HEIGHT = 100;
const ICON_SIZE = 40;

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
  iconColor = theme.colors.primary.main,
  iconBgColor = theme.colors.primary.lighter,
  onPress,
}: StatsCardProps) {
  const { width } = useWindowDimensions();
  const scale = Math.min(1.15, Math.max(0.9, width / 375));
  const valueSize = Math.round(Math.max(18, 22 * scale));
  const labelSize = Math.round(Math.max(11, 12 * scale));

  const content = (
    <View style={styles.inner}>
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={Math.round(22 * scale)} color={iconColor} />
      </View>
      <Text style={[styles.value, { fontSize: valueSize }]}>{value}</Text>
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { fontSize: labelSize }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.container, { opacity: pressed ? 0.8 : 1 }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: CARD_HEIGHT,
    minWidth: 0,
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.borderRadius.card,
    padding: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  inner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    overflow: 'hidden',
  },
  value: {
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  labelWrap: {
    minHeight: 18,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  label: {
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
});
