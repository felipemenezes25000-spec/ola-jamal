import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';

const c = theme.colors;
const s = theme.spacing;

interface AppHeaderProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  transparent?: boolean;
}

export function AppHeader({ title, onBack, right, transparent }: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleBack = onBack || (() => router.back());

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 8 },
        transparent && styles.transparent,
      ]}
    >
      <TouchableOpacity
        onPress={handleBack}
        style={styles.backButton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Voltar"
      >
        <Ionicons name="chevron-back" size={24} color={c.text.primary} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.rightSlot}>{right || <View style={styles.placeholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: theme.colors.background.default,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: c.text.primary,
    textAlign: 'center',
    marginHorizontal: s.sm,
  },
  rightSlot: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 40,
  },
});
