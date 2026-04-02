import React from 'react';
import { View, Text, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { useAppTheme } from '../lib/ui/useAppTheme';

const TAGLINE = 'Renove sua receita e pedido de exames.\nRápido e sem burocracia.';

const LOGO_IMAGE = require('../assets/logo.png');

// Proporção real do logo.png (455x423) — evita distorção ou recorte
const LOGO_ASPECT_RATIO = 455 / 423;

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  /** Exibir só a logo (sem tagline) */
  compact?: boolean;
  /** 'light' = fundo escuro (tagline clara), 'dark' = fundo claro (tagline escura) */
  variant?: 'light' | 'dark';
}

const SIZE_MAP = {
  small:  { width: 130, taglineSize: 12 },
  medium: { width: 170, taglineSize: 13 },
  large:  { width: 220, taglineSize: 14 },
};

export function Logo({ size = 'medium', compact = false, variant = 'light' }: LogoProps) {
  const dims = SIZE_MAP[size];
  const { colors } = useAppTheme();
  const isLight = variant === 'light';
  const taglineColor = isLight ? 'rgba(255,255,255,0.9)' : colors.textMuted;
  const height = dims.width / LOGO_ASPECT_RATIO;

  return (
    <View style={styles.container}>
      <Image
        source={LOGO_IMAGE as ImageSourcePropType}
        style={{ width: dims.width, height }}
        resizeMode="contain"
        accessibilityLabel="Logo RenoveJá"
      />
      {!compact && (
        <Text style={[styles.tagline, { fontSize: dims.taglineSize, color: taglineColor }]}>
          {TAGLINE}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
});
