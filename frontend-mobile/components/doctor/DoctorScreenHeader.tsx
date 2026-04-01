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
  /** Element positioned to the right of the header */
  rightSlot?: React.ReactNode;
  /** Numeric badge displayed to the right of the title */
  countBadge?: number;
  paddingHorizontal?: number;
  paddingBottom?: number;
  borderRadius?: number;
  /** Flat style: white bg with bottom border instead of gradient */
  flat?: boolean;
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
  flat = false,
}: DoctorScreenHeaderProps) {
  if (flat) {
    return (
      <View
        style={[
          styles.headerFlat,
          {
            paddingTop,
            paddingHorizontal,
            paddingBottom: 12,
          },
        ]}
      >
        <View style={styles.row}>
          <View style={styles.textBlock}>
            <View style={styles.titleRow}>
              <Text style={[styles.titleFlat, { color: '#0F172A' }]} numberOfLines={1}>
                {title}
              </Text>
              {countBadge !== undefined && (
                <View style={styles.badgeFlat}>
                  <Text style={styles.badgeTextFlat}>{countBadge}</Text>
                </View>
              )}
            </View>
            {!!subtitle && (
              <Text style={[styles.subtitleFlat, { color: '#64748B' }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          {rightSlot}
        </View>
      </View>
    );
  }

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
  headerFlat: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textBlock: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  titleFlat: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
    letterSpacing: 0.1,
  },
  subtitleFlat: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
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
  badgeFlat: {
    minWidth: 28,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  badgeTextFlat: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0EA5E9',
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
