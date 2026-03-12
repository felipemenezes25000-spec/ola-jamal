import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { uiTokens } from '../../lib/ui/tokens';
import { useResponsive } from '../../lib/ui/responsive';

interface StepIndicatorProps {
  current: number;
  total: number;
  labels?: string[];
  /** Oculta as linhas conectoras entre os passos (evita artefatos visuais em algumas telas). */
  showConnectorLines?: boolean;
}

export function StepIndicator({ current, total, labels, showConnectorLines = true }: StepIndicatorProps) {
  const { colors, typography } = useAppTheme();
  const { isCompact, screenPad } = useResponsive();
  const steps = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);
  const safeCurrent = Math.min(Math.max(current, 1), total);
  const circleSize = isCompact ? 22 : 26;

  return (
    <View
      style={[s.wrap, { paddingHorizontal: screenPad }]}
      accessibilityRole="header"
      accessibilityLabel={`Passo ${safeCurrent} de ${total}`}
    >
      {steps.map((n, idx) => {
        const done = n < safeCurrent;
        const active = n === safeCurrent;
        const label = labels?.[idx];

        const bg = done || active ? colors.primary : colors.surfaceSecondary;
        const fg = done || active ? colors.white : colors.textMuted;
        const border = done || active ? colors.primary : colors.border;

        return (
          <View key={n} style={s.stepCol}>
            <View style={[s.circle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: bg, borderColor: border }]}>
              <Text style={[s.circleText, { color: fg, fontFamily: typography.fontFamily.bold }]}>{n}</Text>
            </View>
            {!isCompact && label ? (
              <Text
                style={[
                  s.label,
                  {
                    color: active ? colors.text : colors.textSecondary,
                    fontFamily: active ? typography.fontFamily.semibold : typography.fontFamily.regular,
                  },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            ) : null}
            {showConnectorLines && idx < total - 1 && (
              <View style={[s.line, { top: circleSize / 2, backgroundColor: n < safeCurrent ? colors.primary : colors.borderLight }]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: uiTokens.spacing.md,
    marginBottom: uiTokens.spacing.sm,
    overflow: 'hidden',
  },
  stepCol: { flex: 1, alignItems: 'center', overflow: 'hidden' },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  circleText: { fontSize: 12, fontWeight: '800' },
  label: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  line: {
    position: 'absolute',
    left: '50%',
    right: '-50%',
    height: 2,
    borderRadius: 2,
  },
});
