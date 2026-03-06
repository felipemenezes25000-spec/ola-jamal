import React, { useState } from 'react';
import { View, Text, StyleSheet, ImageStyle, ViewStyle, Platform } from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

// Blurhash neutro (cinza claro) — placeholder durante o carregamento
const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

interface CompatibleImageProps {
  uri: string | null | undefined;
  style?: ImageStyle | ImageStyle[];
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  onError?: () => void;
  /** Blurhash personalizado para placeholder. Usa o padrão cinza se omitido. */
  blurhash?: string;
}

const RESIZE_TO_CONTENT_FIT: Record<string, ImageContentFit> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  repeat: 'cover',
  center: 'none',
};

/**
 * Componente de imagem com:
 * - Placeholder blurhash animado durante o carregamento (expo-image)
 * - Transição fade-in suave
 * - Fallback para HEIC no web e erros de carregamento
 * - Compatibilidade total com a interface anterior
 */
export function CompatibleImage({
  uri,
  style,
  resizeMode = 'cover',
  onError,
  blurhash = DEFAULT_BLURHASH,
}: CompatibleImageProps) {
  const [hasError, setHasError] = useState(false);

  const uriStr = typeof uri === 'string' ? uri : '';

  if (!uriStr) {
    return (
      <View style={[styles.fallbackContainer, style as ViewStyle]}>
        <Ionicons name="image-outline" size={36} color={colors.textMuted} />
        <Text style={styles.fallbackText}>Imagem indisponível</Text>
      </View>
    );
  }

  const isHeic =
    /\.(heic|heif)$/i.test(uriStr) ||
    uriStr.toLowerCase().includes('heic') ||
    uriStr.toLowerCase().includes('heif');

  if (Platform.OS === 'web' && isHeic) {
    return (
      <View style={[styles.fallbackContainer, style as ViewStyle]}>
        <Ionicons name="image-outline" size={48} color={colors.textMuted} />
        <Text style={styles.fallbackText}>Formato HEIC não suportado no navegador</Text>
        <Text style={styles.fallbackSubtext}>Use o app mobile para visualizar esta imagem</Text>
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={[styles.fallbackContainer, style as ViewStyle]}>
        <Ionicons name="image-outline" size={36} color={colors.textMuted} />
        <Text style={styles.fallbackText}>Erro ao carregar imagem</Text>
        <Text style={styles.fallbackSubtext}>Verifique sua conexão e tente novamente</Text>
      </View>
    );
  }

  return (
    <ExpoImage
      source={{ uri: uriStr }}
      style={style as ImageStyle}
      contentFit={RESIZE_TO_CONTENT_FIT[resizeMode] ?? 'cover'}
      placeholder={{ blurhash }}
      transition={{ duration: 250, effect: 'cross-dissolve' }}
      onError={() => {
        setHasError(true);
        onError?.();
      }}
      cachePolicy="memory-disk"
    />
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 180,
  },
  fallbackText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  fallbackSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
