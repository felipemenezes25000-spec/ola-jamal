import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollViewProps,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme, gradients } from '../../lib/theme';

interface ScreenProps extends ScrollViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'gradient';
  scroll?: boolean;
  padding?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function Screen({
  children,
  variant = 'default',
  scroll = true,
  padding = true,
  style,
  contentStyle,
  edges = ['top', 'bottom'],
  ...scrollViewProps
}: ScreenProps) {
  const paddingStyle = padding
    ? { paddingHorizontal: theme.layout.screen.paddingHorizontal }
    : undefined;

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={gradients.auth as any}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.flex, style]}
        pointerEvents="box-none"
      >
        <SafeAreaView style={styles.flex} edges={edges} pointerEvents="box-none">
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {scroll ? (
              <ScrollView
                style={styles.flex}
                contentContainerStyle={[
                  styles.scrollContent,
                  paddingStyle,
                  contentStyle,
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="interactive"
                scrollEventThrottle={16}
                {...scrollViewProps}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.flex, paddingStyle, contentStyle]}>
                {children}
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              paddingStyle,
              contentStyle,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            scrollEventThrottle={16}
            {...scrollViewProps}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, paddingStyle, contentStyle]}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
});
