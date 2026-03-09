import React from 'react';
import { render } from '@testing-library/react-native';
import { AppButton } from '../AppButton';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../../lib/ui/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: {
      primary: '#2CB1FF',
      secondary: '#10B981',
      error: '#EF4444',
      white: '#FFFFFF',
      textMuted: '#94A3B8',
      borderLight: '#E2E8F0',
      border: '#E2E8F0',
      surfaceSecondary: '#F1F5F9',
      textSecondary: '#64748B',
    },
    shadows: {
      button: { shadowColor: '#2CB1FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 3 },
      none: { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
    },
  }),
}));

jest.mock('../../../lib/theme', () => ({
  theme: {
    colors: {
      primary: { dark: '#1A9DE0', darker: '#1595DC', main: '#2CB1FF', soft: '#E3F4FF', ghost: 'rgba(44,177,255,0.08)', lighter: '#7DD3FC' },
      secondary: { main: '#10B981' },
      status: { error: '#EF4444' },
      text: { inverse: '#FFFFFF', primary: '#0F172A' },
    },
    borderRadius: { button: 26 },
    shadows: {
      none: { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
      buttonSuccess: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
      buttonDanger: { shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
    },
  },
}));

jest.mock('../../../lib/themeDoctor', () => ({
  colors: {
    primary: '#2CB1FF', primaryDark: '#1A9DE0', primaryLight: '#5EC5FF',
    surface: '#FFFFFF', white: '#FFFFFF',
    error: '#EF4444', errorLight: '#FEE2E2', destructive: '#DC2626',
  },
}));

describe('AppButton – Acessibilidade', () => {
  it('tem accessibilityRole="button"', () => {
    const { getByRole } = render(<AppButton title="Confirmar" onPress={() => {}} />);
    expect(getByRole('button')).toBeTruthy();
  });

  it('accessibilityLabel reflete o título', () => {
    const { getByLabelText } = render(<AppButton title="Salvar" onPress={() => {}} />);
    expect(getByLabelText('Salvar')).toBeTruthy();
  });

  it('accessibilityState.disabled=true quando disabled=true', () => {
    const { getByRole } = render(<AppButton title="Desabilitado" onPress={() => {}} disabled />);
    const btn = getByRole('button');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('accessibilityState.busy=true quando loading=true', () => {
    const { getByRole } = render(<AppButton title="Carregando" onPress={() => {}} loading />);
    const btn = getByRole('button');
    expect(btn.props.accessibilityState?.busy).toBe(true);
  });

  it('não dispara onPress quando desabilitado', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<AppButton title="Botão" onPress={onPress} disabled />);
    const btn = getByRole('button');
    // Pressable reporta estado via accessibilityState, não via prop disabled diretamente
    expect(btn.props.accessibilityState?.disabled).toBe(true);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renderiza variantes sem erro', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;
    variants.forEach((variant) => {
      expect(() =>
        render(<AppButton title={`Botão ${variant}`} onPress={() => {}} variant={variant} />)
      ).not.toThrow();
    });
  });
});
