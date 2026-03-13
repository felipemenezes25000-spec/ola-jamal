import { useWindowDimensions } from 'react-native';

/** Largura de referência do design (iPhone 12/13). */
const REF_WIDTH = 375;

/** Largura mínima suportada (iPhone SE, Galaxy A). */
const MIN_WIDTH = 320;

/** Largura a partir da qual consideramos tablet. */
const TABLET_BREAKPOINT = 600;

/**
 * Escala valor proporcionalmente à largura da tela.
 * Clamp entre 0.85 (320px) e 1.25 (tablets) para não extrapolar.
 */
function scale(value: number, width: number): number {
  const ratio = width / REF_WIDTH;
  const clamped = Math.max(0.85, Math.min(1.25, ratio));
  return Math.round(value * clamped);
}

export interface DashboardResponsive {
  /** Largura da tela. */
  screenWidth: number;
  /** < 375px (iPhone SE, Galaxy A). */
  isCompact: boolean;
  /** 375–599px (iPhone 12/13/14). */
  isMedium: boolean;
  /** ≥ 600px (tablets). */
  isTablet: boolean;
  /** Escala atual (0.85–1.25). */
  scale: number;
  /** Padding horizontal (16 em mobile, mais em tablet). */
  paddingHorizontal: number;
  /** Avatar: 78 em ref, escala em compact/tablet. */
  avatarSize: number;
  /** Avatar inner (foto): 70 em ref. */
  avatarInnerSize: number;
  /** Tipografia escalada. */
  typography: {
    greeting: number;
    name: number;
    date: number;
    sectionTitle: number;
    queueTitle: number;
    queueText: number;
    queueButton: number;
    statTitle: number;
    statValue: number;
    quickLabel: number;
    bannerText: number;
  };
  /** Alturas escaladas. */
  heights: {
    banner: number;
    queueCardMin: number;
    queueButton: number;
    statCardMin: number;
    quickButton: number;
  };
  /** Largura máxima do conteúdo em tablets (evita esticar demais). */
  maxContentWidth: number;
  /** Tamanhos de ícones escalados. */
  iconSizes: {
    queueIcon: number;
    statIcon: number;
    quickIcon: number;
  };
}

/**
 * Hook responsivo para o Clinical Soft Dashboard.
 * Garante layout correto em 320px–tablets.
 */
export function useDashboardResponsive(): DashboardResponsive {
  const { width } = useWindowDimensions();
  const safeWidth = Math.max(width, MIN_WIDTH);
  const ratio = safeWidth / REF_WIDTH;
  const scaleFactor = Math.max(0.85, Math.min(1.25, ratio));

  const isCompact = width < 375;
  const isMedium = width >= 375 && width < TABLET_BREAKPOINT;
  const isTablet = width >= TABLET_BREAKPOINT;

  return {
    screenWidth: width,
    isCompact,
    isMedium,
    isTablet,
    scale: scaleFactor,
    paddingHorizontal: isTablet ? 24 : 16,
    avatarSize: scale(78, safeWidth),
    avatarInnerSize: scale(70, safeWidth),
    typography: {
      greeting: scale(26, safeWidth),
      name: scale(26, safeWidth),
      date: scale(15, safeWidth),
      sectionTitle: scale(22, safeWidth),
      queueTitle: scale(22, safeWidth),
      queueText: scale(16, safeWidth),
      queueButton: scale(16, safeWidth),
      statTitle: scale(16, safeWidth),
      statValue: scale(28, safeWidth),
      quickLabel: scale(14, safeWidth),
      bannerText: scale(14, safeWidth),
    },
    heights: {
      banner: scale(48, safeWidth),
      queueCardMin: scale(180, safeWidth),
      queueButton: scale(56, safeWidth),
      statCardMin: scale(120, safeWidth),
      quickButton: scale(96, safeWidth),
    },
    maxContentWidth: isTablet ? 480 : width,
    iconSizes: {
      queueIcon: scale(24, safeWidth),
      statIcon: scale(22, safeWidth),
      quickIcon: scale(22, safeWidth),
    },
  };
}
