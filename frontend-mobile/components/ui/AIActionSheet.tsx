import React, { useMemo } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { uiTokens } from '../../lib/ui/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

export interface AIActionSheetAction {
  key: string;
  label: string;
  description?: string;
  icon?: IconName;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface AIActionSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  actions: AIActionSheetAction[];
  onClose: () => void;
}

export function AIActionSheet({
  visible,
  title = 'Ações do Copiloto IA',
  subtitle,
  actions,
  onClose,
}: AIActionSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, typography, shadows } = useAppTheme();

  const padBottom = Math.max(insets.bottom, uiTokens.spacing.md);
  const sheetShadow = ((shadows as any)?.lg ?? (shadows as any)?.cardLg ?? (shadows as any)?.card ?? undefined) as any;
  const normalized = useMemo(() => actions.filter(Boolean), [actions]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'android' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Fechar menu" accessibilityRole="button" />
      <View style={[s.sheet, { paddingBottom: padBottom, backgroundColor: colors.surface }, sheetShadow]} accessibilityViewIsModal accessibilityRole="none">
        <View style={s.header}>
          <View style={s.headerText}>
            <Text style={[s.title, { color: colors.text, fontFamily: typography.fontFamily.bold }]}>{title}</Text>
            {subtitle ? (
              <Text style={[s.subtitle, { color: colors.textSecondary, fontFamily: typography.fontFamily.regular }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              s.closeBtn,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={s.list}>
          {normalized.map((a) => {
            const icon = a.icon ?? (a.destructive ? 'trash-outline' : 'sparkles-outline');
            const tint = a.destructive ? colors.error : colors.primary;
            return (
              <Pressable
                key={a.key}
                onPress={() => {
                  if (a.disabled) return;
                  onClose();
                  a.onPress();
                }}
                disabled={a.disabled}
                style={({ pressed }) => [
                  s.item,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  pressed && !a.disabled && { backgroundColor: colors.surfaceSecondary },
                  a.disabled && { opacity: 0.55 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                accessibilityHint={a.description}
                accessibilityState={{ disabled: !!a.disabled }}
              >
                <View style={[s.iconBox, { backgroundColor: a.destructive ? colors.errorLight : colors.primarySoft }]}>
                  <Ionicons name={icon} size={18} color={tint} />
                </View>
                <View style={s.itemText}>
                  <Text style={[s.itemLabel, { color: colors.text, fontFamily: typography.fontFamily.semibold }]}>
                    {a.label}
                  </Text>
                  {a.description ? (
                    <Text style={[s.itemDesc, { color: colors.textSecondary, fontFamily: typography.fontFamily.regular }]}>
                      {a.description}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: uiTokens.spacing.md,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: uiTokens.spacing.sm,
  },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingTop: 6, gap: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  iconBox: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1 },
  itemLabel: { fontSize: 14, fontWeight: '700' },
  itemDesc: { marginTop: 2, fontSize: 12, lineHeight: 16 },
});
