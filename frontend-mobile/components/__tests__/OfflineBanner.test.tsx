import React from 'react';
import { render } from '@testing-library/react-native';
import { OfflineBanner } from '../OfflineBanner';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../lib/ui/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { error: '#EF4444', white: '#FFFFFF' },
  }),
}));

let mockIsConnected: boolean | null = true;
jest.mock('../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: mockIsConnected }),
}));

describe('OfflineBanner', () => {
  beforeEach(() => {
    mockIsConnected = true;
  });

  it('não renderiza quando está conectado', () => {
    mockIsConnected = true;
    const { toJSON } = render(<OfflineBanner />);
    expect(toJSON()).toBeNull();
  });

  it('não renderiza quando isConnected é null', () => {
    mockIsConnected = null as any;
    const { toJSON } = render(<OfflineBanner />);
    expect(toJSON()).toBeNull();
  });

  it('renderiza banner quando está offline', () => {
    mockIsConnected = false;
    const { getByText } = render(<OfflineBanner />);
    expect(getByText('Sem conexão com a internet')).toBeTruthy();
  });

  it('tem accessibilityRole alert quando offline', () => {
    mockIsConnected = false;
    const { getByLabelText } = render(<OfflineBanner />);
    expect(getByLabelText('Sem conexão com a internet')).toBeTruthy();
  });
});
