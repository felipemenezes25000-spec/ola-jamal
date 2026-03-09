import React from 'react';
import { render } from '@testing-library/react-native';
import { SkeletonCard, SkeletonList, SkeletonLoader } from '../SkeletonLoader';

jest.mock('../../../lib/ui/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: {
      border: '#e5e7eb',
      surface: '#ffffff',
    },
    shadows: {
      card: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    },
  }),
}));

describe('Skeleton components', () => {
  it('renderiza SkeletonLoader com props padrão', () => {
    const { toJSON } = render(<SkeletonLoader />);
    expect(toJSON()).toBeTruthy();
  });

  it('renderiza SkeletonLoader com tamanho customizado', () => {
    const { toJSON } = render(<SkeletonLoader width={120} height={24} borderRadius={4} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renderiza SkeletonCard sem erros', () => {
    const { toJSON } = render(<SkeletonCard />);
    expect(toJSON()).toBeTruthy();
  });

  it('SkeletonList expõe progressbar acessível', () => {
    const { getByRole, getByLabelText } = render(<SkeletonList count={3} />);
    expect(getByRole('progressbar')).toBeTruthy();
    expect(getByLabelText('Carregando conteúdo')).toBeTruthy();
  });

  it('renderiza lista com count customizado sem falhar', () => {
    const { toJSON } = render(<SkeletonList count={2} />);
    expect(toJSON()).toBeTruthy();
  });
});
