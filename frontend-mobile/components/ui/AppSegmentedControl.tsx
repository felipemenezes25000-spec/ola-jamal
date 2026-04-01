import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ViewStyle } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { AppRole } from '../../lib/designSystem';
import { uiTokens } from '../../lib/ui/tokens';

const MIN_TOUCH = 44;

export type AppSegmentedControlSize = 'sm' | 'md';

export interface AppSegmentedItem {
  key: string;
  label: string;
  /** Optional count badge (ex.: "A pagar: 2"). */
  count?: number;
}

interface AppSegmentedControlProps {
  items: AppSegmentedItem[];
  value: string;
  onValueChange: (key: string) => void;
  disabled?: boolean;
  size?: AppSegmentedControlSize;
  /** When true, allows horizontal scrolling (useful for >4 items). */
  scrollable?: boolean;
  style?: ViewStyle;
  /** Força tema (ex.: doctor) quando usado em rotas que podem não resolver por pathname. */
  role?: AppRole;
}

export function AppSegmentedControl({
  items,
  value,
  onValueChange,
  disabled = false,
  size = 'md',
  scrollable,
  style,
  role,
}: AppSegmentedControlProps) {
  const { colors, typography, shadows } = useAppTheme(role ? { role } : undefined);
  const muted = (colors as any).muted ?? colors.surfaceSecondary;

  const conf = useMemo(() => {
    const isSm = size === 'sm';
    return {
      height: isSm ? 40 : 46,
      padV: isSm ? 8 : 10,
      fontSize: isSm ? 12 : 13,
      badgeFontSize: isSm ? 10 : 11,
      borderRadius: isSm ? 12 : 14,
    };
  }, [size]);

  const content = (
    <View style={[s.container, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, style]}>
      {items.map((item) => {
        const isSelected = value === item.key;
        const showCount = typeof item.count === 'number';

        return (
          <Pressable
            key={item.key}
            onPress={() => !disabled && onValueChange(item.key)}
            disabled={disabled}
            style={({ pressed }) => [
              s.segment,
              {
                minHeight: Math.max(MIN_TOUCH, conf.height),
                borderRadius: conf.borderRadius - 2,
                paddingVertical: conf.padV,
              },
              isSelected && [
                s.segmentActive,
                { backgroundColor: colors.primary, borderColor: colors.primary },
                shadows.sm,
              ],
              pressed && !disabled && s.pressed,
              disabled && s.disabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={item.label}
          >
            <View style={s.labelRow}>
              <Text
                style={[
                  s.label,
                  {
                    fontSize: conf.fontSize,
                    fontFamily: typography.fontFamily.bold,
                    color: isSelected ? colors.white : colors.textSecondary,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {item.label}
              </Text>
              {showCount && (
                <View
                  style={[
                    s.badge,
                    {
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : muted,
                      borderColor: isSelected ? 'rgba(255,255,255,0.3)' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: conf.badgeFontSize,
                      fontFamily: typography.fontFamily.bold,
                      color: isSelected ? colors.white : colors.textSecondary,
                    }}
                  >
                    {String(item.count)}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const shouldScroll = !!scrollable || items.length > 4;
  if (!shouldScroll) {
    return <View style={s.wrapper}>{content}</View>;
  }

  return (
    <View style={s.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.scrollContent, { flexGrow: 0 }]}>
        <View style={[s.container, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {items.map((item) => {
            const isSelected = value === item.key;
            const showCount = typeof item.count === 'number';
            const muted = (colors as { muted?: string }).muted ?? colors.surfaceSecondary;
            return (
              <Pressable
                key={item.key}
                onPress={() => !disabled && onValueChange(item.key)}
                disabled={disabled}
                style={({ pressed }) => [
                  s.segmentScrollable,
                  { minHeight: Math.max(MIN_TOUCH, conf.height), borderRadius: conf.borderRadius - 2, paddingVertical: conf.padV },
                  isSelected && [s.segmentActive, { backgroundColor: colors.primary, borderColor: colors.primary }, shadows.sm],
                  pressed && !disabled && s.pressed,
                  disabled && s.disabled,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
                accessibilityLabel={item.label}
              >
                <View style={s.labelRow}>
                  <Text style={[s.label, { fontSize: conf.fontSize, fontFamily: typography.fontFamily.bold, color: isSelected ? colors.white : colors.textSecondary }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {showCount && (
                    <View style={[s.badge, { backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : muted, borderColor: isSelected ? 'rgba(255,255,255,0.3)' : colors.border }]}>
                      <Text style={{ fontSize: conf.badgeFontSize, fontFamily: typography.fontFamily.bold, color: isSelected ? colors.white : colors.textSecondary }}>{String(item.count)}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingTop: uiTokens.spacing.sm,
    paddingBottom: uiTokens.spacing.sm,
  },
  scrollContent: {
    paddingRight: uiTokens.spacing.md,
  },
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 3,
    gap: 3,
    alignSelf: 'flex-start',
  },
  segment: {
    flex: 1,
    minWidth: 72,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentScrollable: {
    flex: 0,
    minWidth: 96,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: {
    borderWidth: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  badge: {
    minWidth: 22,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
