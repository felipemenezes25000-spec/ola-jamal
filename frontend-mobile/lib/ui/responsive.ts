import { useMemo } from 'react';
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

// ---------------------------------------------------------------------------
// useResponsive — hook universal de responsividade
// ---------------------------------------------------------------------------

/** Largura de referência do design (iPhone 12/13). */
const REF_WIDTH = 375;
/** Largura mínima suportada (iPhone SE, Galaxy A). */
const MIN_WIDTH = 320;
/** Breakpoint de tablet. */
const TABLET_BREAKPOINT = 600;

/**
 * Escala valor proporcionalmente à largura da tela.
 * Clamp entre 0.85 (320px) e 1.25 (tablets).
 */
export function responsiveScale(value: number, width: number): number {
  const ratio = Math.max(width, MIN_WIDTH) / REF_WIDTH;
  const clamped = Math.max(0.85, Math.min(1.25, ratio));
  return Math.round(value * clamped);
}

export interface Responsive {
  /** < 375px (iPhone SE, Galaxy A). */
  isCompact: boolean;
  /** 375–413px (iPhone 12/13/14). */
  isMedium: boolean;
  /** ≥ 414px (iPhone Plus/Max). */
  isLarge: boolean;
  /** ≥ 600px (tablets). */
  isTablet: boolean;
  /** Largura atual da tela. */
  screenWidth: number;
  /** Fator de escala atual (0.85–1.25). */
  scaleFactor: number;
  /**
   * Escala um valor de referência (design 375px) proporcionalmente.
   * Ex: rs(16) → 14 em 320px, 16 em 375px, 20 em 480px.
   */
  rs: (value: number) => number;
  /** Padding horizontal responsivo para telas: 12 | 16 | 20 | 24. */
  screenPad: number;
  /** Gap entre seções de conteúdo: 12 | 16 | 20 | 24. */
  contentGap: number;
}

/**
 * Hook universal de responsividade. Substitui valores hardcoded por escala
 * proporcional à largura da tela, de 320px a tablets.
 *
 * Uso: `const { rs, screenPad, isCompact } = useResponsive();`
 */
export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const safeWidth = Math.max(width, MIN_WIDTH);
    const ratio = safeWidth / REF_WIDTH;
    const scaleFactor = Math.max(0.85, Math.min(1.25, ratio));

    const isCompact = width < 375;
    const isMedium = width >= 375 && width < 414;
    const isLarge = width >= 414 && width < TABLET_BREAKPOINT;
    const isTablet = width >= TABLET_BREAKPOINT;

    const rs = (value: number) => Math.round(value * scaleFactor);

    let screenPad: number;
    if (isCompact) screenPad = 12;
    else if (isMedium) screenPad = 16;
    else if (isTablet) screenPad = 24;
    else screenPad = 20;

    let contentGap: number;
    if (isCompact) contentGap = 12;
    else if (isMedium) contentGap = 16;
    else if (isTablet) contentGap = 24;
    else contentGap = 20;

    return {
      isCompact,
      isMedium,
      isLarge,
      isTablet,
      screenWidth: width,
      scaleFactor,
      rs,
      screenPad,
      contentGap,
    };
  }, [width]);
}
