import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { uiTokens } from '../../lib/ui/tokens';

interface StepIndicatorProps {
  current: number;
  total: number;
  labels?: string[];
  /** Oculta as linhas conectoras entre os passos (evita artefatos visuais em algumas telas). */
  showConnectorLines?: boolean;
}

export function StepIndicator({ current, total, labels, showConnectorLines = true }: StepIndicatorProps) {
  const { colors, typography } = useAppTheme();
  const steps = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);
  const safeCurrent = Math.min(Math.max(current, 1), total);

  return (
    <View
      style={s.wrap}
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
            <View style={[s.circle, { backgroundColor: bg, borderColor: border }]}>
              <Text style={[s.circleText, { color: fg, fontFamily: typography.fontFamily.bold }]}>{n}</Text>
            </View>
            {label ? (
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
              <View style={[s.line, { backgroundColor: n < safeCurrent ? colors.primary : colors.borderLight }]} />
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
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    overflow: 'hidden',
  },
  stepCol: { flex: 1, alignItems: 'center', overflow: 'hidden' },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  circleText: { fontSize: 13, fontWeight: '700' },
  label: { marginTop: 8, fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },
  line: {
    position: 'absolute',
    top: 15,
    left: '50%',
    right: '-50%',
    height: 2,
    borderRadius: 2,
  },
});
