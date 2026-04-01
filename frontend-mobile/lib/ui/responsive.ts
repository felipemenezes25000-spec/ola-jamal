import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';

/** Altura base da tab bar (mesma usada nos layouts). */
const TAB_BAR_BASE = 56;
const TAB_BAR_PAD_TOP = 8;
const EXTRA_MARGIN = 16;

/**
 * Calcula o paddingBottom ideal para listas/scroll que precisam
 * não ficar atrás da tab bar. Substitui os `paddingBottom: 120` hardcoded.
 */
export function useListBottomPadding(): number {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Math.max(72, TAB_BAR_BASE + TAB_BAR_PAD_TOP + insets.bottom);
  return tabBarHeight + EXTRA_MARGIN;
}

const STICKY_CTA_HEIGHT = 88;
const STICKY_CTA_EXTRA_GAP = 24;

/**
 * Padding inferior para telas com CTA fixa sobreposta ao conteúdo.
 * Evita uso de valores mágicos como `+150`.
 */
export function useStickyCtaScrollPadding(): number {
  return useListBottomPadding() + STICKY_CTA_HEIGHT + STICKY_CTA_EXTRA_GAP;
}

type ScreenCategory = {
  isCompact: boolean;   // < 375px (SE, Galaxy A)
  isMedium: boolean;    // 375–413px (iPhone 12/13/14)
  isLarge: boolean;     // 414–767px (iPhone Plus/Max)
  isTablet: boolean;    // ≥ 768px (iPad Mini, tablets)
  isDesktop: boolean;   // ≥ 1024px (iPad Pro landscape, large tablets)
  screenWidth: number;
  screenHeight: number;
};

/**
 * Retorna a categoria de tamanho de tela atual.
 * Responde a mudanças de orientação e resize.
 * Inclui breakpoints para tablets (≥768px) e desktop-class (≥1024px).
 */
export function useScreenCategory(): ScreenCategory {
  const { width, height } = useWindowDimensions();
  return {
    isCompact: width < 375,
    isMedium: width >= 375 && width < 414,
    isLarge: width >= 414 && width < 768,
    isTablet: width >= 768,
    isDesktop: width >= 1024,
    screenWidth: width,
    screenHeight: height,
  };
}

/**
 * Returns a responsive value based on current screen size.
 * Falls back from tablet → large → medium → compact.
 */
export function useResponsiveValue<T>(values: {
  compact?: T;
  medium?: T;
  large?: T;
  tablet?: T;
  desktop?: T;
  default: T;
}): T {
  const { isCompact, isMedium, isLarge, isTablet, isDesktop } = useScreenCategory();
  if (isDesktop && values.desktop !== undefined) return values.desktop;
  if (isTablet && values.tablet !== undefined) return values.tablet;
  if (isLarge && values.large !== undefined) return values.large;
  if (isMedium && values.medium !== undefined) return values.medium;
  if (isCompact && values.compact !== undefined) return values.compact;
  return values.default;
}
