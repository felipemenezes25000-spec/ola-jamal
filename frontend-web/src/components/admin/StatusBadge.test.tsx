import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('deve renderizar badge "Pendente" para status pending', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('deve renderizar badge "Aprovado" para status approved', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
  });

  it('deve renderizar badge "Recusado" para status rejected', () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByText('Recusado')).toBeInTheDocument();
  });

  it('deve retornar null para status desconhecido', () => {
    // @ts-expect-error - testando status inválido propositalmente
    const { container } = render(<StatusBadge status="unknown" />);
    expect(container.innerHTML).toBe('');
  });

  it('deve aplicar classes corretas para status pending', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByText('Pendente');
    expect(badge.className).toContain('bg-warning');
  });

  it('deve aplicar classes corretas para status approved', () => {
    render(<StatusBadge status="approved" />);
    const badge = screen.getByText('Aprovado');
    expect(badge.className).toContain('bg-success');
  });

  it('deve aplicar classes corretas para status rejected', () => {
    render(<StatusBadge status="rejected" />);
    const badge = screen.getByText('Recusado');
    expect(badge.className).toContain('bg-destructive');
  });
});
