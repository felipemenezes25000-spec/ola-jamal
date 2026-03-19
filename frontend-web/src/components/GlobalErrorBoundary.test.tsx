import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobalErrorBoundary } from './GlobalErrorBoundary';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Erro de teste');
  return <p>Conteúdo filho</p>;
}

describe('GlobalErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('deve renderizar os filhos quando não há erro', () => {
    render(
      <GlobalErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </GlobalErrorBoundary>
    );
    expect(screen.getByText('Conteúdo filho')).toBeInTheDocument();
  });

  it('deve exibir tela de fallback quando ocorre erro', () => {
    render(
      <GlobalErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </GlobalErrorBoundary>
    );
    expect(screen.getByText('O app encontrou um problema')).toBeInTheDocument();
    expect(screen.getByText(/Algo inesperado aconteceu/)).toBeInTheDocument();
  });

  it('deve exibir botão "Tentar novamente"', () => {
    render(
      <GlobalErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </GlobalErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument();
  });

  it('deve exibir o ID do erro', () => {
    render(
      <GlobalErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </GlobalErrorBoundary>
    );
    expect(screen.getByText(/ID:/)).toBeInTheDocument();
  });

  it('deve resetar o estado ao clicar em "Tentar novamente"', async () => {
    const user = userEvent.setup();

    // Precisamos de um componente que pode alternar entre erro e sucesso
    let shouldThrow = true;
    function ToggleChild() {
      if (shouldThrow) throw new Error('Erro');
      return <p>Recuperado</p>;
    }

    const { rerender } = render(
      <GlobalErrorBoundary>
        <ToggleChild />
      </GlobalErrorBoundary>
    );

    expect(screen.getByText('O app encontrou um problema')).toBeInTheDocument();

    // Atualiza para não lançar erro antes de clicar
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));

    rerender(
      <GlobalErrorBoundary>
        <ToggleChild />
      </GlobalErrorBoundary>
    );

    expect(screen.getByText('Recuperado')).toBeInTheDocument();
  });

  it('deve reportar erro ao Sentry', async () => {
    const Sentry = await import('@sentry/react');

    render(
      <GlobalErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </GlobalErrorBoundary>
    );

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          'crash.level': 'global',
          'crash.source': 'GlobalErrorBoundary',
        }),
      })
    );
  });
});
