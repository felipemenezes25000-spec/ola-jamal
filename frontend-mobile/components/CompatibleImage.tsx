import React, { useState } from 'react';
import { Image, View, Text, StyleSheet, ImageStyle, ViewStyle, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

interface CompatibleImageProps {
  uri: string;
  style?: ImageStyle | ImageStyle[];
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  onError?: () => void;
}

/**
 * Componente de imagem compatível que trata formatos HEIC/HEIF no web.
 * Navegadores web não suportam HEIC nativamente, então mostra um fallback informativo.
 */
export function CompatibleImage({ uri, style, resizeMode = 'cover', onError }: CompatibleImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Detecta se é HEIC/HEIF pela URL ou extensão
  const isHeic = /\.(heic|heif)$/i.test(uri) || 
                 uri.toLowerCase().includes('heic') || 
                 uri.toLowerCase().includes('heif');

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  // No web, se for HEIC ou houver erro, mostra fallback
  if (Platform.OS === 'web' && (isHeic || hasError)) {
    return (
      <View style={[styles.fallbackContainer, style as ViewStyle]}>
        <Ionicons name="image-outline" size={48} color={colors.textMuted} />
        <Text style={styles.fallbackText}>
          {isHeic ? 'Formato HEIC não suportado no navegador' : 'Erro ao carregar imagem'}
        </Text>
        <Text style={styles.fallbackSubtext}>
          {isHeic 
            ? 'Use o app mobile para visualizar esta imagem' 
            : 'Verifique sua conexão e tente novamente'}
        </Text>
      </View>
    );
  }

  // No mobile ou se não for HEIC, renderiza normalmente
  return (
    <View style={style as ViewStyle}>
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingContainer]}>
          <Ionicons name="image-outline" size={32} color={colors.textMuted} />
        </View>
      )}
      <Image
        source={{ uri }}
        style={style}
        resizeMode={resizeMode}
        onError={handleError}
        onLoad={handleLoad}
      />
    </View>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
