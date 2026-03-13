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
  isLarge: boolean;     // ≥ 414px (iPhone Plus/Max, tablets)
  screenWidth: number;
};

/**
 * Retorna a categoria de tamanho de tela atual.
 * Responde a mudanças de orientação e resize.
 */
export function useScreenCategory(): ScreenCategory {
  const { width } = useWindowDimensions();
  return {
    isCompact: width < 375,
    isMedium: width >= 375 && width < 414,
    isLarge: width >= 414,
    screenWidth: width,
  };
}
