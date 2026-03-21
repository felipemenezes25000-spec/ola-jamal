import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobalErrorBoundary } from './GlobalErrorBoundary';

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Erro de teste');
  return <p>Conteudo filho</p>;
}

describe('GlobalErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('deve renderizar os filhos quando nao ha erro', () => {
    render(
      <GlobalErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </GlobalErrorBoundary>
    );
    expect(screen.getByText('Conteudo filho')).toBeInTheDocument();
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

  it('deve exibir botao "Tentar novamente"', () => {
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

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /Tentar novamente/i }));

    rerender(
      <GlobalErrorBoundary>
        <ToggleChild />
      </GlobalErrorBoundary>
    );

    expect(screen.getByText('Recuperado')).toBeInTheDocument();
  });
});
