import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';

const c = theme.colors;
const s = theme.spacing;

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  transparent?: boolean;
  /** Pass gradient colors array to render a gradient background with white text */
  gradient?: readonly string[] | string[];
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  left,
  right,
  transparent,
  gradient,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleBack = onBack || (() => router.back());

  const isGradient = !!gradient;
  const textColor = isGradient ? '#FFFFFF' : c.text.primary;
  const backBgColor = isGradient ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)';

  const content = (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 8 },
        transparent && styles.transparent,
        !isGradient && !transparent && styles.defaultBg,
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
      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[styles.subtitle, { color: isGradient ? 'rgba(255,255,255,0.85)' : c.text.secondary }]}
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
  defaultBg: {
    backgroundColor: theme.colors.background.default,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: s.sm,
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
    minWidth: 40,
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 40,
  },
});
