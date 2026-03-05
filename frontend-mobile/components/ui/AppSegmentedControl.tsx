import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ViewStyle } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';
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
}

export function AppSegmentedControl({
  items,
  value,
  onValueChange,
  disabled = false,
  size = 'md',
  scrollable,
  style,
}: AppSegmentedControlProps) {
  const { colors, typography, shadows } = useAppTheme();
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
                { backgroundColor: colors.surface, borderColor: colors.borderLight },
                (shadows as any)?.sm,
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
                    color: isSelected ? colors.primary : colors.textMuted,
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
                      backgroundColor: isSelected ? colors.primaryGhost : muted,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: conf.badgeFontSize,
                      fontFamily: typography.fontFamily.bold,
                      color: isSelected ? colors.primary : colors.textMuted,
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {content}
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
    minWidth: 88,
    paddingHorizontal: 10,
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
    gap: 8,
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
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
