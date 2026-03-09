import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../lib/designSystem';

interface DoctorScreenHeaderProps {
  title: string;
  subtitle?: string;
  paddingTop: number;
  colors: DesignColors;
  gradientColors: readonly string[];
  /** Elemento posicionado à direita do header */
  rightSlot?: React.ReactNode;
  /** Badge numérico exibido à direita do título */
  countBadge?: number;
  paddingHorizontal?: number;
  paddingBottom?: number;
  borderRadius?: number;
}

export function DoctorScreenHeader({
  title,
  subtitle,
  paddingTop,
  colors,
  gradientColors,
  rightSlot,
  countBadge,
  paddingHorizontal = 20,
  paddingBottom = 28,
  borderRadius = 32,
}: DoctorScreenHeaderProps) {
  return (
    <LinearGradient
      colors={gradientColors as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.header,
        {
          paddingTop,
          paddingHorizontal,
          paddingBottom,
          borderBottomLeftRadius: borderRadius,
          borderBottomRightRadius: borderRadius,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.headerOverlayText }]} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subtitle, { color: colors.headerOverlayTextMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {countBadge !== undefined && (
          <View style={[styles.badge, { backgroundColor: colors.headerOverlaySurface, borderColor: colors.headerOverlayBorder }]}>
            <Text style={[styles.badgeText, { color: colors.headerOverlayText }]}>{countBadge}</Text>
          </View>
        )}

        {rightSlot}
      </View>
    </LinearGradient>
  );
}

interface DoctorHeaderActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  colors: DesignColors;
  accessibilityLabel?: string;
}

export function DoctorHeaderAction({ icon, onPress, colors, accessibilityLabel }: DoctorHeaderActionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.actionBtn, { backgroundColor: colors.headerOverlaySurface, borderColor: colors.headerOverlayBorder }]}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={18} color={colors.headerOverlayText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textBlock: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
    letterSpacing: 0.1,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 12,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 10,
    flexShrink: 0,
  },
});
