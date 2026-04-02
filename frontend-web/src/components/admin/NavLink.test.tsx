import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NavLink } from './NavLink';

function renderWithRouter(ui: React.ReactElement, initialEntries = ['/']) {
  return render(
    <MemoryRouter
      initialEntries={initialEntries}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      {ui}
    </MemoryRouter>
  );
}

describe('NavLink', () => {
  it('deve renderizar como link com texto', () => {
    renderWithRouter(<NavLink to="/admin">Dashboard</NavLink>);
    expect(
      screen.getByRole('link', { name: /Dashboard/i })
    ).toBeInTheDocument();
  });

  it('deve apontar para a rota correta', () => {
    renderWithRouter(<NavLink to="/admin/medicos">Médicos</NavLink>);
    const link = screen.getByRole('link', { name: /Médicos/i });
    expect(link).toHaveAttribute('href', '/admin/medicos');
  });

  it('deve aplicar className base', () => {
    renderWithRouter(
      <NavLink to="/admin" className="base-class">
        Dashboard
      </NavLink>
    );
    const link = screen.getByRole('link', { name: /Dashboard/i });
    expect(link.className).toContain('base-class');
  });

  it('deve aplicar activeClassName quando rota está ativa', () => {
    renderWithRouter(
      <NavLink to="/" className="base" activeClassName="active-class">
        Home
      </NavLink>,
      ['/']
    );
    const link = screen.getByRole('link', { name: /Home/i });
    expect(link.className).toContain('active-class');
  });

  it('não deve aplicar activeClassName quando rota não está ativa', () => {
    renderWithRouter(
      <NavLink to="/outra" className="base" activeClassName="active-class">
        Outra
      </NavLink>,
      ['/']
    );
    const link = screen.getByRole('link', { name: /Outra/i });
    expect(link.className).not.toContain('active-class');
  });
});
