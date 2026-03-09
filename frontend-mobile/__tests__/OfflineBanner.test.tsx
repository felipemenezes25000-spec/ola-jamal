/**
 * @jest-environment jsdom
 */

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => {
      const { accessibilityRole, accessibilityLabel, style, ...rest } = props;
      return React.createElement('div', {
        ...rest,
        role: accessibilityRole,
        'aria-label': accessibilityLabel,
        'data-testid': 'offline-banner-view',
      }, props.children);
    },
    Text: (props: any) => React.createElement('span', props, props.children),
    StyleSheet: {
      create: (s: any) => s,
    },
  };
});

jest.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('../lib/ui/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { error: '#EF4444', white: '#FFFFFF' },
  }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: Record<string, unknown>) =>
      React.createElement('span', { 'data-testid': 'ionicons-mock' }),
  };
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<
  typeof useNetworkStatus
>;

describe('OfflineBanner', () => {
  beforeEach(() => {
    mockUseNetworkStatus.mockReset();
  });

  it('renders nothing when connected', () => {
    mockUseNetworkStatus.mockReturnValue({ isConnected: true });
    const { container } = render(<OfflineBanner />);
    expect(container.childElementCount).toBe(0);
  });

  it('renders nothing when isConnected is null', () => {
    mockUseNetworkStatus.mockReturnValue({ isConnected: null });
    const { container } = render(<OfflineBanner />);
    expect(container.childElementCount).toBe(0);
  });

  it('renders banner when disconnected', () => {
    mockUseNetworkStatus.mockReturnValue({ isConnected: false });
    const { container } = render(<OfflineBanner />);
    expect(container.childElementCount).toBeGreaterThan(0);
  });

  it('shows offline text when disconnected', () => {
    mockUseNetworkStatus.mockReturnValue({ isConnected: false });
    render(<OfflineBanner />);
    expect(screen.getByText('Sem conexão com a internet')).toBeTruthy();
  });

  it('has alert accessibility role', () => {
    mockUseNetworkStatus.mockReturnValue({ isConnected: false });
    render(<OfflineBanner />);
    const alertEl = screen.getByRole('alert', { name: 'Sem conexão com a internet' });
    expect(alertEl).toBeTruthy();
  });

  it('has correct accessibility label', () => {
    mockUseNetworkStatus.mockReturnValue({ isConnected: false });
    render(<OfflineBanner />);
    const alertEl = screen.getByLabelText('Sem conexão com a internet');
    expect(alertEl).toBeTruthy();
  });

  it('transitions from offline to online', () => {
    mockUseNetworkStatus.mockReturnValue({ isConnected: false });
    const { container, rerender } = render(<OfflineBanner />);
    expect(container.childElementCount).toBeGreaterThan(0);

    mockUseNetworkStatus.mockReturnValue({ isConnected: true });
    rerender(<OfflineBanner />);
    expect(container.childElementCount).toBe(0);
  });
});
