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

  // No web, se for HEIC, mostra fallback (browsers não suportam HEIC nativamente)
  if (Platform.OS === 'web' && isHeic) {
    return (
      <View style={[styles.fallbackContainer, style as ViewStyle]}>
        <Ionicons name="image-outline" size={48} color={colors.textMuted} />
        <Text style={styles.fallbackText}>Formato HEIC não suportado no navegador</Text>
        <Text style={styles.fallbackSubtext}>Use o app mobile para visualizar esta imagem</Text>
      </View>
    );
  }

  // Erro ao carregar imagem (mobile ou web)
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
