import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  Animated,
  type ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { markOnboardingDone } from '../lib/onboarding';
import { haptics } from '../lib/haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Slide Data ────────────────────────────────────────────────
interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'document-text',
    iconBg: '#DBEAFE',
    iconColor: '#2563EB',
    title: 'Receitas sem fila',
    description:
      'Solicite receitas e exames direto pelo celular. Sem esperar, sem burocracia.',
  },
  {
    icon: 'videocam',
    iconBg: '#D1FAE5',
    iconColor: '#059669',
    title: 'Teleconsultas gratuitas',
    description:
      'Consulte com médicos de verdade por videochamada, onde e quando precisar.',
  },
  {
    icon: 'heart',
    iconBg: '#FCE7F3',
    iconColor: '#DB2777',
    title: '100% pelo SUS',
    description:
      'Todo atendimento é gratuito e coberto pelo Sistema Único de Saúde.',
  },
];

// ─── Component ─────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLast = currentIndex === SLIDES.length - 1;

  const goNext = useCallback(async () => {
    haptics.selection();
    if (isLast) {
      await markOnboardingDone();
      router.replace('/(auth)/login');
    } else {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  }, [isLast, currentIndex, router]);

  const goToLogin = useCallback(async () => {
    haptics.light();
    await markOnboardingDone();
    router.replace('/(auth)/login');
  }, [router]);

  // ─── Render Slide ──────────────────────────────────────────
  const renderSlide = useCallback(
    ({ item, index }: { item: Slide; index: number }) => {
      const inputRange = [
        (index - 1) * SCREEN_W,
        index * SCREEN_W,
        (index + 1) * SCREEN_W,
      ];

      const scale = scrollX.interpolate({
        inputRange,
        outputRange: [0.8, 1, 0.8],
        extrapolate: 'clamp',
      });

      const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
      });

      return (
        <View style={styles.slideContainer}>
          <Animated.View
            style={[
              styles.slideContent,
              { opacity, transform: [{ scale }] },
            ]}
          >
            {/* Icon Circle */}
            <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
              <Ionicons name={item.icon} size={48} color={item.iconColor} />
            </View>

            {/* Title */}
            <Text style={styles.slideTitle}>{item.title}</Text>

            {/* Description */}
            <Text style={styles.slideDescription}>{item.description}</Text>
          </Animated.View>
        </View>
      );
    },
    [scrollX, styles],
  );

  // ─── Render ────────────────────────────────────────────────
  const contentPaddingBottom = Math.max(insets.bottom, 16);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* ── Header Section ── */}
      <View style={styles.header}>
        <Text style={styles.welcomeLabel}>BEM-VINDO AO</Text>
        <Text style={styles.brandName}>
          Renove<Text style={styles.brandAccent}>J{'á'}</Text>
        </Text>
        <Text style={styles.tagline}>Sa{'ú'}de gratuita ao seu alcance</Text>
      </View>

      {/* ── Slides ── */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={styles.slidesList}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
      />

      {/* ── Dots ── */}
      <View
        style={styles.dotsRow}
        accessibilityLabel={`Passo ${currentIndex + 1} de ${SLIDES.length}`}
      >
        {SLIDES.map((_, i) => {
          const dotWidth = scrollX.interpolate({
            inputRange: [
              (i - 1) * SCREEN_W,
              i * SCREEN_W,
              (i + 1) * SCREEN_W,
            ],
            outputRange: [8, 28, 8],
            extrapolate: 'clamp',
          });

          const dotOpacity = scrollX.interpolate({
            inputRange: [
              (i - 1) * SCREEN_W,
              i * SCREEN_W,
              (i + 1) * SCREEN_W,
            ],
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity: dotOpacity,
                  backgroundColor: '#0EA5E9',
                },
              ]}
            />
          );
        })}
      </View>

      {/* ── SUS Badge ── */}
      <View style={styles.susBadge}>
        <Ionicons name="shield-checkmark" size={16} color="#059669" />
        <Text style={styles.susBadgeText}>
          Atendimento gratuito via SUS — Conv{'ê'}nio Municipal
        </Text>
      </View>

      {/* ── Bottom Actions ── */}
      <View style={[styles.bottomActions, { paddingBottom: contentPaddingBottom }]}>
        {/* CTA Button */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaBtn,
            pressed && styles.ctaBtnPressed,
          ]}
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Come\u00e7ar a usar o aplicativo' : 'Pr\u00f3ximo passo'}
        >
          <Text style={styles.ctaText}>
            {isLast ? 'Come\u00e7ar' : 'Pr\u00f3ximo'}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color="#FFFFFF"
          />
        </Pressable>

        {/* Login Link */}
        <Pressable
          onPress={goToLogin}
          style={styles.loginBtn}
          accessibilityRole="link"
          accessibilityLabel="Ir para login"
        >
          <Text style={styles.loginHint}>
            J{'á'} tenho conta{' '}
            <Text style={styles.loginLink}>Entrar</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────
function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#F8FAFC',
    },

    // ── Header ──
    header: {
      alignItems: 'center',
      paddingTop: 16,
      paddingBottom: 4,
    },
    welcomeLabel: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 2,
      color: '#94A3B8',
      marginBottom: 4,
    },
    brandName: {
      fontSize: 32,
      fontWeight: '700',
      color: '#0F172A',
      letterSpacing: -0.5,
    },
    brandAccent: {
      color: '#0EA5E9',
    },
    tagline: {
      fontSize: 15,
      fontWeight: '400',
      color: '#64748B',
      marginTop: 4,
    },

    // ── Slides ──
    slidesList: {
      flexGrow: 0,
      height: SCREEN_H * 0.38,
    },
    slideContainer: {
      width: SCREEN_W,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    slideContent: {
      alignItems: 'center',
      maxWidth: 320,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    slideTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: '#0F172A',
      textAlign: 'center',
      marginBottom: 10,
      letterSpacing: -0.3,
    },
    slideDescription: {
      fontSize: 15,
      fontWeight: '400',
      color: '#64748B',
      textAlign: 'center',
      lineHeight: 23,
      paddingHorizontal: 8,
    },

    // ── Dots ──
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      marginBottom: 16,
    },
    dot: {
      height: 8,
      borderRadius: 4,
    },

    // ── SUS Badge ──
    susBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#F0FDF4',
      marginHorizontal: 24,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#BBF7D0',
    },
    susBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#15803D',
    },

    // ── Bottom Actions ──
    bottomActions: {
      paddingHorizontal: 24,
      paddingTop: 16,
    },
    ctaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#0EA5E9',
      borderRadius: 14,
      paddingVertical: 16,
      width: '100%',
      minHeight: 56,
      shadowColor: '#0EA5E9',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 6,
    },
    ctaBtnPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    ctaText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    loginBtn: {
      alignItems: 'center',
      paddingVertical: 16,
      minHeight: 44,
      justifyContent: 'center',
    },
    loginHint: {
      fontSize: 14,
      fontWeight: '400',
      color: '#94A3B8',
    },
    loginLink: {
      color: '#0EA5E9',
      fontWeight: '700',
    },
  });
}
