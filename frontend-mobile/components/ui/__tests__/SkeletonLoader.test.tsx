import React from 'react';
import { render } from '@testing-library/react-native';
import { SkeletonCard, SkeletonList, SkeletonLoader } from '../SkeletonLoader';

jest.mock('../../../lib/theme', () => ({
  theme: {
    colors: {
      border: { main: '#e5e7eb' },
      background: { paper: '#ffffff' },
    },
  },
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
