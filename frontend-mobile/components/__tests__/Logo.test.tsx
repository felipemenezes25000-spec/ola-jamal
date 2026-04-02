import React from 'react';
import { render } from '@testing-library/react-native';
import { Logo } from '../Logo';

jest.mock('../../lib/ui/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { textMuted: '#64748b' },
  }),
}));

jest.mock('../../lib/designSystem', () => ({
  shadows: { lg: { shadowColor: '#000' } },
}));

// Mock do asset para evitar require do arquivo real em ambiente de teste
jest.mock('../../assets/logo.jpg', () => ({ uri: 'mock-logo.jpg' }), { virtual: true });

describe('Logo', () => {
  it('renderiza com tamanho padrão', () => {
    const { getByLabelText } = render(<Logo />);
    expect(getByLabelText('Logo RenoveJá')).toBeTruthy();
  });

  it('renderiza tagline quando compact é false', () => {
    const { getByText } = render(<Logo compact={false} />);
    expect(getByText(/Renove sua receita/)).toBeTruthy();
  });

  it('não renderiza tagline quando compact é true', () => {
    const { queryByText } = render(<Logo compact />);
    expect(queryByText(/Renove sua receita/)).toBeNull();
  });

  it('aceita sizes small, medium, large', () => {
    expect(() => render(<Logo size="small" />)).not.toThrow();
    expect(() => render(<Logo size="medium" />)).not.toThrow();
    expect(() => render(<Logo size="large" />)).not.toThrow();
  });

  it('aceita variant light e dark', () => {
    expect(() => render(<Logo variant="light" />)).not.toThrow();
    expect(() => render(<Logo variant="dark" />)).not.toThrow();
  });
});
