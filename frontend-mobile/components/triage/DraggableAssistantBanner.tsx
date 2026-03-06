/**
 * DraggableAssistantBanner — Dra. Renoveja discreta e arrastável
 *
 * - Botãozinho discreto com ícone de IA (sparkles)
 * - Toque para expandir / recolher
 * - Arraste para mover para qualquer lugar da tela
 * - Posição persistida entre sessões
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  Text,
  ScrollView,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, Pressable as GHPressable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../lib/theme';
import { useTriageAssistant } from '../../contexts/TriageAssistantProvider';
import {
  getBannerFloatingPosition,
  setBannerFloatingPosition,
  setBannerPositionMode,
} from '../../lib/triage/triagePersistence';
import type { BannerFloatingPosition } from '../../lib/triage/triage.types';
import { AssistantBanner } from './AssistantBanner';
import type { CTAAction } from '../../lib/triage/triage.types';

const FAB_SIZE = 48;
const BANNER_WIDTH = 300;
const SPRING_CONFIG = { damping: 22, stiffness: 200 };
const DRAG_THRESHOLD = 16; // Maior para evitar conflito com tap — tap expande, arraste move

interface DraggableAssistantBannerProps {
  onAction?: (action: CTAAction, message?: { requestId?: string; status?: string | null }) => void;
  onCompanionPress?: () => void;
  containerStyle?: object;
}

export function DraggableAssistantBanner({ onAction, onCompanionPress, containerStyle }: DraggableAssistantBannerProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { current } = useTriageAssistant();

  const padding = 16;
  const [expanded, setExpanded] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [lastAutoExpandKey, setLastAutoExpandKey] = useState<string | null>(null);

  const translateX = useSharedValue(screenW - padding - FAB_SIZE);
  const translateY = useSharedValue(screenH - (insets.bottom ?? 0) - padding - FAB_SIZE);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  const bannerWidth = Math.min(screenW - padding * 2, BANNER_WIDTH);

  const topLimitFab = (insets.top ?? 0) + padding;
  const maxXFabInit = screenW - FAB_SIZE - padding;
  const maxYFabInit = screenH - FAB_SIZE - (insets.bottom ?? 0) - padding;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pos = await getBannerFloatingPosition();
        if (!cancelled && pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
          // Garantir que posição salva esteja dentro da tela visível
          const x = Math.max(padding, Math.min(maxXFabInit, pos.x));
          const y = Math.max(topLimitFab, Math.min(maxYFabInit, pos.y));
          translateX.value = x;
          translateY.value = y;
        } else if (!cancelled) {
          translateX.value = screenW - padding - FAB_SIZE;
          translateY.value = screenH - (insets.bottom ?? 0) - padding - FAB_SIZE;
        }
        if (!cancelled) setInitialized(true);
      } catch {
        if (!cancelled) {
          translateX.value = screenW - padding - FAB_SIZE;
          translateY.value = screenH - (insets.bottom ?? 0) - padding - FAB_SIZE;
          setInitialized(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Bolinha pisca quando há recomendação relevante (pulse suave)
  useEffect(() => {
    if (current && !expanded) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 250 });
    }
  }, [!!current, expanded]);

  const savePosition = useCallback(async (x: number, y: number) => {
    await setBannerPositionMode('floating');
    await setBannerFloatingPosition({ x, y, anchor: 'bottom-right' });
  }, []);

  const expandedHeight = Math.min(180, screenH - (insets.top ?? 0) - (insets.bottom ?? 0) - padding * 2);
  const handleExpand = useCallback(() => {
    const topLimit = (insets.top ?? 0) + padding;
    const bottomLimit = screenH - expandedHeight - (insets.bottom ?? 0) - padding;
    const maxX = screenW - bannerWidth - padding;
    let x = translateX.value;
    let y = translateY.value;
    if (x > maxX) x = maxX;
    if (x < padding) x = padding;
    if (y > bottomLimit) y = bottomLimit;
    if (y < topLimit) y = topLimit;
    translateX.value = withSpring(x, SPRING_CONFIG);
    translateY.value = withSpring(y, SPRING_CONFIG);
    setExpanded(true);
    savePosition(x, y);
  }, [screenW, screenH, bannerWidth, padding, insets, expandedHeight]);

  const handleCollapse = useCallback(() => {
    setExpanded(false);
  }, []);

  // Auto-expande para mensagens de maior urgência/relevância e evita “sumir”
  useEffect(() => {
    if (!current?.key) return;
    if (expanded) return;
    if (lastAutoExpandKey === current.key) return;
    if (current.severity === 'attention') {
      handleExpand();
      setLastAutoExpandKey(current.key);
    }
  }, [current?.key, current?.severity, expanded, lastAutoExpandKey, handleExpand]);

  const topLimit = (insets.top ?? 0) + padding;
  const bottomLimitFab = screenH - FAB_SIZE - (insets.bottom ?? 0) - padding;
  const bottomLimitExpanded = screenH - expandedHeight - (insets.bottom ?? 0) - padding;
  const maxXFab = screenW - FAB_SIZE - padding;
  const maxXExpanded = screenW - bannerWidth - padding;

  const panGestureFab = Gesture.Pan()
    .minDistance(DRAG_THRESHOLD)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const x = Math.max(padding, Math.min(maxXFab, startX.value + e.translationX));
      const y = Math.max(topLimit, Math.min(bottomLimitFab, startY.value + e.translationY));
      translateX.value = x;
      translateY.value = y;
    })
    .onEnd(() => {
      const finalX = translateX.value;
      const finalY = translateY.value;
      translateX.value = withSpring(finalX, SPRING_CONFIG);
      translateY.value = withSpring(finalY, SPRING_CONFIG);
      runOnJS(savePosition)(finalX, finalY);
    });

  const panGestureExpanded = Gesture.Pan()
    .minDistance(DRAG_THRESHOLD)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const x = Math.max(padding, Math.min(maxXExpanded, startX.value + e.translationX));
      const y = Math.max(topLimit, Math.min(bottomLimitExpanded, startY.value + e.translationY));
      translateX.value = x;
      translateY.value = y;
    })
    .onEnd(() => {
      const finalX = translateX.value;
      const finalY = translateY.value;
      translateX.value = withSpring(finalX, SPRING_CONFIG);
      translateY.value = withSpring(finalY, SPRING_CONFIG);
      runOnJS(savePosition)(finalX, finalY);
    });

  const tapGesture = Gesture.Tap()
    .maxDistance(20) // Tolerante a pequeno movimento — evita falha ao tocar
    .onEnd(() => {
      runOnJS(handleExpand)();
    });

  // Tap primeiro: prioridade para expandir ao tocar; Pan só ativa após arrastar 16px
  const composedGestureFab = Gesture.Exclusive(tapGesture, panGestureFab);

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: pulseScale.value },
    ],
  }));

  const expandedAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  if (!initialized) return null;

  return (
    <View
      style={[
        styles.wrapper,
        {
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        },
        containerStyle,
      ]}
      pointerEvents="box-none"
    >
      {!expanded ? (
        <GestureDetector gesture={composedGestureFab}>
          <Animated.View
            style={[
              styles.fab,
              { width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2 },
              fabAnimatedStyle,
            ]}
          >
            <View style={styles.fabInner}>
              <Ionicons name="sparkles" size={22} color={theme.colors.primary.main} />
            </View>
          </Animated.View>
        </GestureDetector>
      ) : (
        <GestureDetector gesture={panGestureExpanded}>
          <Animated.View
            style={[
              styles.expandedContainer,
              {
                width: bannerWidth,
                height: expandedHeight,
              },
              expandedAnimatedStyle,
            ]}
          >
            <View style={styles.expandedHeader}>
              <View style={styles.expandedHeaderLeft}>
                <View style={styles.expandedFabIcon}>
                  <Ionicons name="sparkles" size={14} color={theme.colors.primary.main} />
                </View>
                <Text style={styles.expandedHeaderLabel}>Dra. Renoveja</Text>
              </View>
              <GHPressable
                onPress={handleCollapse}
                hitSlop={12}
                style={({ pressed }) => [styles.collapseBtn, pressed && styles.collapseBtnPressed]}
                accessibilityLabel="Recolher assistente"
              >
                <Ionicons name="chevron-down" size={20} color={theme.colors.text.secondary} />
              </GHPressable>
            </View>
            <ScrollView
              style={styles.bannerScroll}
              contentContainerStyle={styles.bannerScrollContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              <AssistantBanner
                onAction={onAction}
                onCompanionPress={onCompanionPress}
                containerStyle={styles.bannerContent}
              />
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 0,
  },
  fab: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: theme.colors.background.paper,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  fabInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  bannerScroll: {
    flexGrow: 0,
  },
  bannerScrollContent: {
    flexGrow: 0,
    paddingBottom: 12,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: theme.colors.background.default,
  },
  expandedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandedFabIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedHeaderLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: theme.colors.text.primary,
  },
  collapseBtn: {
    padding: 4,
  },
  collapseBtnPressed: {
    opacity: 0.7,
  },
  bannerContent: {
    marginHorizontal: 0,
    marginBottom: 0,
  },
});
