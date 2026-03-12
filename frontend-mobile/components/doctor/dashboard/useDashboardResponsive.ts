import { useResponsive } from '../../../lib/ui/responsive';

export interface DashboardResponsive {
  screenWidth: number;
  isCompact: boolean;
  isMedium: boolean;
  isTablet: boolean;
  scale: number;
  paddingHorizontal: number;
  avatarSize: number;
  avatarInnerSize: number;
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
  heights: {
    banner: number;
    queueCardMin: number;
    queueButton: number;
    statCardMin: number;
    quickButton: number;
  };
  maxContentWidth: number;
  iconSizes: {
    queueIcon: number;
    statIcon: number;
    quickIcon: number;
  };
}

/**
 * Hook responsivo para o Clinical Soft Dashboard.
 * Delega ao useResponsive() universal, mantendo a interface DashboardResponsive.
 */
export function useDashboardResponsive(): DashboardResponsive {
  const { rs, isCompact, isMedium, isTablet, screenWidth, scaleFactor, screenPad } = useResponsive();

  return {
    screenWidth,
    isCompact,
    isMedium,
    isTablet,
    scale: scaleFactor,
    paddingHorizontal: screenPad,
    avatarSize: rs(48),
    avatarInnerSize: rs(42),
    typography: {
      greeting: rs(16),
      name: rs(18),
      date: rs(13),
      sectionTitle: rs(16),
      queueTitle: rs(18),
      queueText: rs(14),
      queueButton: rs(14),
      statTitle: rs(13),
      statValue: rs(22),
      quickLabel: rs(13),
      bannerText: rs(14),
    },
    heights: {
      banner: rs(48),
      queueCardMin: rs(160),
      queueButton: rs(44),
      statCardMin: rs(100),
      quickButton: rs(56),
    },
    maxContentWidth: isTablet ? 480 : screenWidth,
    iconSizes: {
      queueIcon: rs(24),
      statIcon: rs(22),
      quickIcon: rs(22),
    },
  };
}
