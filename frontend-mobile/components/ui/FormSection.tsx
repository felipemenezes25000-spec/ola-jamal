import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { uiTokens } from '../../lib/ui/tokens';

interface FormSectionProps {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function FormSection({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  children,
  style,
  contentStyle,
}: FormSectionProps) {
  const { colors, typography } = useAppTheme();

  const showHeader = !!title || !!subtitle || (!!actionLabel && !!onActionPress);

  return (
    <View style={[s.wrap, style]}>
      {showHeader && (
        <View style={s.headerRow}>
          <View style={s.headerText}>
            {!!title && (
              <Text style={[s.title, { color: colors.text, fontFamily: typography.fontFamily.bold }]}>
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text style={[s.subtitle, { color: colors.textSecondary, fontFamily: typography.fontFamily.regular }]}>
                {subtitle}
              </Text>
            )}
          </View>

          {!!actionLabel && !!onActionPress && (
            <Pressable
              onPress={onActionPress}
              style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
            >
              <Text style={[s.actionText, { color: colors.primary, fontFamily: typography.fontFamily.semibold }]}>
                {actionLabel}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          )}
        </View>
      )}

      <View style={[s.content, { backgroundColor: colors.surface, borderColor: colors.border }, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10, marginTop: uiTokens.spacing.lg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  headerText: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 2 },
  actionText: { fontSize: 13, fontWeight: '700' },
  content: {
    marginHorizontal: uiTokens.screenPaddingHorizontal,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
});
