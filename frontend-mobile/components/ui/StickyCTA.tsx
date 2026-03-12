import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { uiTokens } from '../../lib/ui/tokens';
import { theme } from '../../lib/theme';
import { AppButton, AppButtonVariant } from './AppButton';
import { useResponsive } from '../../lib/ui/responsive';

type Action = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: AppButtonVariant;
};

interface StickyCTAProps {
  summaryTitle?: string;
  summaryValue?: string;
  summaryHint?: string;
  primary: Action;
  secondary?: Action;
  extraBottomInset?: number;
  style?: ViewStyle;
}

export function StickyCTA({
  summaryTitle,
  summaryValue,
  summaryHint,
  primary,
  secondary,
  extraBottomInset = 0,
  style,
}: StickyCTAProps) {
  const insets = useSafeAreaInsets();
  const { colors, shadows, typography, role } = useAppTheme();
  const { isCompact, screenPad } = useResponsive();

  const padBottom = Math.max(insets.bottom, uiTokens.spacing.md) + extraBottomInset;

  const resolveVariant = (a: Action, kind: 'primary' | 'secondary'): AppButtonVariant => {
    if (a.variant) return a.variant;
    if (role === 'doctor') return kind === 'primary' ? 'doctorPrimary' : 'doctorOutline';
    return kind === 'primary' ? 'primary' : 'outline';
  };

  const content = (
    <View
      style={[
        s.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: padBottom,
          paddingHorizontal: screenPad,
          zIndex: theme.zIndex.sticky,
        },
        ((shadows as any)?.sm ?? undefined) as any,
        style,
      ]}
    >
      {(summaryTitle || summaryValue || summaryHint) && (
        <View style={s.summaryRow}>
          <View style={s.summaryTextWrap}>
            {!!summaryTitle && (
              <Text style={[s.summaryTitle, { color: colors.textSecondary, fontFamily: typography.fontFamily.medium }]}>
                {summaryTitle}
              </Text>
            )}
            {!!summaryHint && (
              <Text style={[s.summaryHint, { color: colors.textMuted, fontFamily: typography.fontFamily.regular }]}>
                {summaryHint}
              </Text>
            )}
          </View>
          {!!summaryValue && (
            <Text style={[s.summaryValue, { color: colors.text, fontFamily: typography.fontFamily.bold }]}>
              {summaryValue}
            </Text>
          )}
        </View>
      )}

      <View style={[s.buttonsRow, isCompact && s.buttonsCol]}>
        {secondary && (
          <View style={s.secondaryCol}>
            <AppButton
              title={secondary.label}
              onPress={secondary.onPress}
              disabled={secondary.disabled}
              loading={secondary.loading}
              variant={resolveVariant(secondary, 'secondary')}
              fullWidth
            />
          </View>
        )}
        <View style={s.primaryCol}>
          <AppButton
            title={primary.label}
            onPress={primary.onPress}
            disabled={primary.disabled}
            loading={primary.loading}
            variant={resolveVariant(primary, 'primary')}
            fullWidth
          />
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'ios') return <KeyboardAvoidingView behavior="padding">{content}</KeyboardAvoidingView>;
  return content;
}

const s = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: uiTokens.spacing.md,
    gap: uiTokens.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryTextWrap: { flex: 1, minWidth: 0 },
  summaryTitle: { fontSize: 13, fontWeight: '600' },
  summaryHint: { marginTop: 2, fontSize: 12, lineHeight: 16 },
  summaryValue: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  buttonsRow: { flexDirection: 'row', gap: 12 },
  buttonsCol: { flexDirection: 'column' },
  secondaryCol: { flex: 1 },
  primaryCol: { flex: 1.4 },
});
