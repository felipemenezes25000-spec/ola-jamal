import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AppEmptyState } from '../AppEmptyState';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const mockTheme = {
  colors: {
    primary: '#2CB1FF',
    primarySoft: '#E3F4FF',
    text: '#0F172A',
    textSecondary: '#475569',
    white: '#FFFFFF',
  },
  typography: {
    fontFamily: { bold: 'System', regular: 'System' },
  },
  shadows: { button: {} },
};

jest.mock('../../../lib/ui/useAppTheme', () => ({
  useAppTheme: () => mockTheme,
}));

describe('AppEmptyState', () => {
  it('renderiza título e subtitle', () => {
    const { getByText } = render(
      <AppEmptyState
        icon="alert-circle-outline"
        title="Nada por aqui"
        subtitle="Sem resultados"
      />
    );
    expect(getByText('Nada por aqui')).toBeTruthy();
    expect(getByText('Sem resultados')).toBeTruthy();
  });

  it('não renderiza subtitle quando não passado', () => {
    const { queryByText } = render(
      <AppEmptyState icon="notifications-off-outline" title="Vazio" />
    );
    expect(queryByText('Sem resultados')).toBeNull();
  });

  it('renderiza botão de ação quando actionLabel e onAction fornecidos', () => {
    const { getByRole } = render(
      <AppEmptyState
        icon="alert-circle-outline"
        title="Erro"
        actionLabel="Tentar novamente"
        onAction={() => {}}
      />
    );
    expect(getByRole('button')).toBeTruthy();
  });

  it('não renderiza botão quando onAction ausente', () => {
    const { queryByRole } = render(
      <AppEmptyState
        icon="alert-circle-outline"
        title="Erro"
        actionLabel="Tentar novamente"
      />
    );
    expect(queryByRole('button')).toBeNull();
  });

  it('dispara onAction ao pressionar o botão', () => {
    const onAction = jest.fn();
    const { getByRole } = render(
      <AppEmptyState
        icon="alert-circle-outline"
        title="Erro"
        actionLabel="Tentar novamente"
        onAction={onAction}
      />
    );
    fireEvent.press(getByRole('button'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('accessibilityLabel do botão é o actionLabel', () => {
    const { getByLabelText } = render(
      <AppEmptyState
        icon="alert-circle-outline"
        title="Erro"
        actionLabel="Recarregar página"
        onAction={() => {}}
      />
    );
    expect(getByLabelText('Recarregar página')).toBeTruthy();
  });

  it('renderiza diferentes ícones sem erros', () => {
    const icons = [
      'alert-circle-outline',
      'notifications-off-outline',
      'document-text-outline',
    ] as const;
    icons.forEach((icon) => {
      expect(() =>
        render(<AppEmptyState icon={icon} title="Teste" />)
      ).not.toThrow();
    });
  });
});
