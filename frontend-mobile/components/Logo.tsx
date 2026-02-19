import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  /** 'light' = texto claro (fundo escuro/gradiente), 'dark' = texto escuro (fundo claro) */
  variant?: 'light' | 'dark';
}

const SIZE_MAP = {
  small: { width: 120, height: 60, fontSize: 20 },
  medium: { width: 180, height: 90, fontSize: 26 },
  large: { width: 220, height: 110, fontSize: 32 },
};

// Logo em texto para o app rodar sem depender de assets/logo.png.
// Para usar imagem: coloque logo.png em assets/ e descomente o bloco com Image no código.
export function Logo({ size = 'medium', variant = 'light' }: LogoProps) {
  const dims = SIZE_MAP[size];
  const textColor = variant === 'dark' ? '#0F172A' : '#FFFFFF';
  return (
    <View style={[styles.container, { width: dims.width, height: dims.height }]}>
      <Text style={[styles.fallbackText, { fontSize: dims.fontSize, color: textColor }]}>RenoveJá+</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: {
    fontWeight: '700',
    ...(Platform.OS === 'web' ? { fontFamily: 'system-ui, sans-serif' } : {}),
  },
});
