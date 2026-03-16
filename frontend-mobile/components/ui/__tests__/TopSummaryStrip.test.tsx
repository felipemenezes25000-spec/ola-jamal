import React from 'react';
import { render } from '@testing-library/react-native';
import { TopSummaryStrip } from '../TopSummaryStrip';

jest.mock('../../../lib/ui/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { surface: '#fff', borderLight: '#e2e8f0', text: '#0f172a', textMuted: '#64748b' },
  }),
}));

jest.mock('../../../lib/ui/tokens', () => ({
  uiTokens: { screenPaddingHorizontal: 20 },
}));

describe('TopSummaryStrip', () => {
  it('renderiza items', () => {
    const { getByText } = render(
      <TopSummaryStrip
        items={[
          { label: 'Pedidos', value: 3 },
          { label: 'Total', value: 1 },
        ]}
      />
    );
    expect(getByText('3')).toBeTruthy();
    expect(getByText('Pedidos')).toBeTruthy();
    expect(getByText('1')).toBeTruthy();
    expect(getByText('Total')).toBeTruthy();
  });

  it('aceita compact', () => {
    const { getByText } = render(
      <TopSummaryStrip items={[{ label: 'X', value: 'Y' }]} compact />
    );
    expect(getByText('Y')).toBeTruthy();
  });
});
