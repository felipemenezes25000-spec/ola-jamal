import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { uiTokens } from '../../lib/ui/tokens';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  transparent?: boolean;
  gradient?: readonly string[] | string[];
  skipSafeAreaTop?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  left,
  right,
  transparent,
  gradient,
  skipSafeAreaTop,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useAppTheme();
  
  const handleBack = onBack || (() => router.back());

  const isGradient = !!gradient;
  const textColor = isGradient ? colors.headerOverlayText : colors.text;
  const backBgColor = isGradient ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)';
  const topPadding = skipSafeAreaTop ? 8 : insets.top + 8;

  const content = (
    <View
      style={[
        styles.container,
        { paddingTop: topPadding },
        transparent && styles.transparent,
        !isGradient && !transparent && { backgroundColor: colors.background },
      ]}
    >
      {left || (
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: backBgColor }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={24} color={textColor} />
        </TouchableOpacity>
      )}
      <View style={[styles.titleWrap, { marginHorizontal: spacing.sm }]}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[styles.subtitle, { color: isGradient ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.rightSlot}>{right || <View style={styles.placeholder} />}</View>
    </View>
  );

  if (isGradient) {
    return (
      <LinearGradient
        colors={gradient as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {content}
      </LinearGradient>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: 12,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 44,
  },
});
