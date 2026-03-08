import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { uiTokens } from '../../lib/ui/tokens';
import { haptics } from '../../lib/haptics';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Header padrão para telas secundárias (Ajuda, Sobre, Configurações, etc.).
 * Botão voltar + título alinhado à esquerda + slot opcional à direita.
 */
export function ScreenHeader({ title, onBack, right, style }: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const handleBack = () => {
    haptics.selection();
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }, style]}>
      <TouchableOpacity
        onPress={handleBack}
        style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary }]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.rightSlot}>{right ?? <View style={styles.placeholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    marginLeft: 12,
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 44,
  },
});
