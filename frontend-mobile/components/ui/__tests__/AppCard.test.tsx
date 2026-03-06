import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AppCard } from '../AppCard';

jest.mock('../../../lib/theme', () => ({
  theme: {
    colors: {
      background: { paper: '#fff' },
      border: { light: '#ddd' },
      primary: { main: '#2CB1FF', soft: '#E3F4FF' },
    },
    borderRadius: { card: 12 },
    spacing: { md: 16 },
    shadows: {
      card: { shadowColor: '#000', elevation: 2 },
      elevated: { shadowColor: '#000', elevation: 4 },
    },
  },
}));

describe('AppCard', () => {
  it('renderiza children', () => {
    const { getByText } = render(
      <AppCard>
        <Text>Conteúdo</Text>
      </AppCard>
    );

    expect(getByText('Conteúdo')).toBeTruthy();
  });

  it('vira botão quando recebe onPress e dispara callback', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <AppCard onPress={onPress} accessibilityLabel="Abrir card">
        <Text>Item</Text>
      </AppCard>
    );

    const button = getByRole('button');
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('aceita variantes sem quebrar', () => {
    const variants = ['default', 'elevated', 'outlined'] as const;
    variants.forEach((variant) => {
      expect(() =>
        render(
          <AppCard variant={variant}>
            <Text>{variant}</Text>
          </AppCard>
        )
      ).not.toThrow();
    });
  });

  it('aplica estado selected sem erro', () => {
    const { getByText } = render(
      <AppCard selected>
        <Text>Selecionado</Text>
      </AppCard>
    );

    expect(getByText('Selecionado')).toBeTruthy();
  });

  it('suporta noPadding=true', () => {
    const { getByText } = render(
      <AppCard noPadding>
        <Text>Sem padding</Text>
      </AppCard>
    );

    expect(getByText('Sem padding')).toBeTruthy();
  });
});
