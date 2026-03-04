/**
 * DraggableAssistantBanner — Dra. Renova com opção de mover ou acompanhar
 *
 * Modo fixo: fica no fundo da tela (acompanha o usuário).
 * Modo flutuante: usuário pode arrastar para qualquer canto; encaixa ao soltar.
 * Long-press no avatar para alternar entre modos.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import {
  getBannerPositionMode,
  getBannerFloatingPosition,
  setBannerPositionMode,
  setBannerFloatingPosition,
} from '../../lib/triage/triagePersistence';
import type { BannerPositionMode, BannerFloatingPosition } from '../../lib/triage/triage.types';
import { AssistantBanner } from './AssistantBanner';
import type { CTAAction } from '../../lib/triage/triage.types';

const BANNER_WIDTH = 340;
const BANNER_HEIGHT_EST = 120;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

type Anchor = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

function snapToAnchor(
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number,
  topInset: number,
  bottomInset: number,
  bannerW: number
): { x: number; y: number; anchor: Anchor } {
  const halfW = width / 2;
  const halfH = height / 2;
  const cx = x + bannerW / 2;
  const cy = y + BANNER_HEIGHT_EST / 2;

  const topY = topInset + padding;
  const bottomY = height - BANNER_HEIGHT_EST - bottomInset - padding;

  if (cy < halfH) {
    return cx < halfW
      ? { x: padding, y: topY, anchor: 'top-left' }
      : { x: width - bannerW - padding, y: topY, anchor: 'top-right' };
  }
  return cx < halfW
    ? { x: padding, y: bottomY, anchor: 'bottom-left' }
    : { x: width - bannerW - padding, y: bottomY, anchor: 'bottom-right' };
}

interface DraggableAssistantBannerProps {
  onAction?: (action: CTAAction) => void;
  /** Quando o usuário toca no estado companion — ex.: abrir ajuda/FAQ */
  onCompanionPress?: () => void;
  containerStyle?: object;
}

export function DraggableAssistantBanner({ onAction, onCompanionPress, containerStyle }: DraggableAssistantBannerProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Mostra imediatamente em modo fixo — posição persistida carrega em background
  const [mode, setMode] = useState<BannerPositionMode>('fixed');
  const [floatingPos, setFloatingPos] = useState<BannerFloatingPosition | null>(null);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const padding = Math.max(uiTokens.screenPaddingHorizontal, insets.left, insets.right);
  const bottomFixed = insets.bottom + uiTokens.cardGap * 2;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [m, pos] = await Promise.all([
        getBannerPositionMode(),
        getBannerFloatingPosition(),
      ]);
      if (!cancelled) {
        setMode(m);
        setFloatingPos(pos);
        if (pos && m === 'floating') {
          translateX.value = pos.x;
          translateY.value = pos.y;
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveFloating = useCallback(async (x: number, y: number, anchor: Anchor) => {
    const pos: BannerFloatingPosition = { x, y, anchor };
    setFloatingPos(pos);
    await setBannerFloatingPosition(pos);
  }, []);

  const switchToFloating = useCallback(async () => {
    setMode('floating');
    await setBannerPositionMode('floating');
    const defaultX = padding;
    const defaultY = screenH - BANNER_HEIGHT_EST - bottomFixed;
    translateX.value = defaultX;
    translateY.value = defaultY;
    runOnJS(saveFloating)(defaultX, defaultY, 'bottom-left');
  }, [padding, screenH, bottomFixed, saveFloating]);

  const switchToFixed = useCallback(async () => {
    setMode('fixed');
    await setBannerPositionMode('fixed');
  }, []);

  const bannerWidth = Math.min(screenW - padding * 2, BANNER_WIDTH);

  const panGesture = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      let nx = startX.value + e.translationX;
      let ny = startY.value + e.translationY;
      const minX = 0;
      const maxX = screenW - bannerWidth - padding * 2;
      const minY = insets.top + 8;
      const maxY = screenH - BANNER_HEIGHT_EST - insets.bottom - 8;
      nx = Math.max(minX, Math.min(maxX, nx));
      ny = Math.max(minY, Math.min(maxY, ny));
      translateX.value = nx;
      translateY.value = ny;
    })
    .onEnd((e) => {
      const vx = e.velocityX;
      const vy = e.velocityY;
      let nx = translateX.value;
      let ny = translateY.value;
      if (Math.abs(vx) > 200 || Math.abs(vy) > 200) {
        nx += vx * 0.08;
        ny += vy * 0.08;
      }
      const snapped = snapToAnchor(nx, ny, screenW, screenH, padding, insets.top, insets.bottom, bannerWidth);
      translateX.value = withSpring(snapped.x, SPRING_CONFIG);
      translateY.value = withSpring(snapped.y, SPRING_CONFIG);
      runOnJS(saveFloating)(snapped.x, snapped.y, snapped.anchor);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const handleLongPressAvatar = useCallback(() => {
    if (mode === 'fixed') {
      switchToFloating();
    } else {
      switchToFixed();
    }
  }, [mode, switchToFloating, switchToFixed]);

  const isFixed = mode === 'fixed';

  return (
    <View
      style={[
        styles.wrapper,
        isFixed
          ? {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: bottomFixed,
            }
          : {
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              marginHorizontal: 0,
            },
        containerStyle,
      ]}
      pointerEvents="box-none"
    >
      {isFixed ? (
        <View style={styles.fixedInner}>
          <AssistantBanner onAction={onAction} onCompanionPress={onCompanionPress} />
          <Pressable
            onLongPress={handleLongPressAvatar}
            delayLongPress={600}
            style={styles.dragHint}
            hitSlop={8}
          >
            <Ionicons
              name="move-outline"
              size={14}
              color={theme.colors.text.disabled}
            />
          </Pressable>
        </View>
      ) : (
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.floatingInner,
              { top: 0, left: 0, width: bannerWidth },
              animatedStyle,
            ]}
          >
            <View style={styles.dragHandle}>
              <Ionicons name="reorder-three" size={18} color={theme.colors.text.tertiary} />
              <Pressable onPress={switchToFixed} hitSlop={8} style={styles.pinBtn}>
                <Ionicons name="pin" size={14} color={theme.colors.primary.main} />
              </Pressable>
            </View>
            <AssistantBanner
              onAction={onAction}
              onCompanionPress={onCompanionPress}
              containerStyle={styles.bannerNoMargin}
            />
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: uiTokens.screenPaddingHorizontal,
  },
  fixedInner: {
    position: 'relative',
  },
  dragHint: {
    position: 'absolute',
    right: 8,
    top: 8,
    padding: 4,
    opacity: 0.7,
  },
  floatingInner: {
    position: 'absolute',
    width: BANNER_WIDTH,
    marginHorizontal: 0,
  },
  dragHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.colors.background.paper,
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
  },
  pinBtn: {
    padding: 4,
  },
  bannerNoMargin: {
    marginHorizontal: 0,
  },
});
