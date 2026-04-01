import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isAuthenticated, logout } from './adminApi';

describe('adminApi', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAuthenticated', () => {
    it('deve retornar false quando não há token', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('deve retornar true quando há token e login_at válido', () => {
      localStorage.setItem('admin_auth_token', 'abc123');
      localStorage.setItem('admin_login_at', String(Date.now()));
      expect(isAuthenticated()).toBe(true);
    });
  });

  describe('logout', () => {
    it('deve remover token do localStorage', async () => {
      localStorage.setItem('admin_auth_token', 'abc123');
      // Mock fetch for the backend logout call (best-effort, does not block)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

      await logout();

      expect(localStorage.getItem('admin_auth_token')).toBeNull();
    });
  });
});
