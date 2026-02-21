/**
 * Botão primário padrão do fluxo médico.
 * Altura 52, borderRadius 16, azul sólido, seta opcional à direita.
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, doctorDS } from '../../lib/themeDoctor';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  showArrow?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  showArrow = false,
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        !isDisabled && styles.enabled,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <View style={styles.content}>
          <Text style={styles.label}>{label}</Text>
          {showArrow && (
            <Ionicons name="chevron-forward" size={20} color="#fff" style={styles.arrow} />
          )}
        </View>
      )}
    </Pressable>
  );
}

const PRIMARY_BG = '#1A9DE0';
const PRIMARY_BORDER = '#1583C7';

const styles = StyleSheet.create({
  button: {
    height: doctorDS.buttonHeight,
    minHeight: 52,
    borderRadius: doctorDS.buttonRadius,
    backgroundColor: PRIMARY_BG,
    borderWidth: 2,
    borderColor: PRIMARY_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  enabled: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  arrow: {
    marginLeft: 2,
  },
});
