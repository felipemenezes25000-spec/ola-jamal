import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminLayout } from './AdminLayout';

vi.mock('./AdminSidebar', () => ({
  AdminSidebar: () => <nav data-testid="admin-sidebar">Sidebar Mock</nav>,
}));

describe('AdminLayout', () => {
  it('deve renderizar o sidebar', () => {
    render(<AdminLayout>Conteúdo</AdminLayout>);
    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
  });

  it('deve renderizar os filhos no main', () => {
    render(<AdminLayout><p>Conteúdo da página</p></AdminLayout>);
    expect(screen.getByText('Conteúdo da página')).toBeInTheDocument();
  });

  it('deve ter estrutura flex com min-h-screen', () => {
    const { container } = render(<AdminLayout>Teste</AdminLayout>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('min-h-screen');
  });

  it('deve renderizar main com overflow-auto', () => {
    render(<AdminLayout>Teste</AdminLayout>);
    const main = screen.getByRole('main');
    expect(main.className).toContain('overflow-auto');
  });
});
