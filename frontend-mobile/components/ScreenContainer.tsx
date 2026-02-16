import React from 'react';
import { ScrollView, StyleSheet, View, ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';

interface ScreenContainerProps extends ScrollViewProps {
  children: React.ReactNode;
  noScroll?: boolean;
  noPadding?: boolean;
}

export function ScreenContainer({
  children,
  noScroll = false,
  noPadding = false,
  style,
  ...scrollViewProps
}: ScreenContainerProps) {
  if (noScroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={[styles.container, noPadding && styles.noPadding, style]}>
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, noPadding && styles.noPadding, style]}
        showsVerticalScrollIndicator={false}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
    padding: theme.spacing.md,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  noPadding: {
    padding: 0,
  },
});
