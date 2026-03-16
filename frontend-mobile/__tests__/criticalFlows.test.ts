/**
 * Testes de integração dos fluxos críticos do app.
 * Garante que as regras de negócio centrais não regridam.
 */

import { validate } from '../lib/validation/validate';
import { loginSchema, resetPasswordSchema } from '../lib/validation/schemas';
import { getRequestUiState, isSignedOrDelivered } from '../lib/domain/getRequestUiState';
import { isOnboardingDone, markOnboardingDone } from '../lib/onboarding';

// ─── Mock AsyncStorage ───────────────────────────────────────
const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete store[key];
    return Promise.resolve();
  }),
}));

// ─── Fluxo: Login ─────────────────────────────────────────────

describe('Fluxo de Login', () => {
  it('aceita credenciais válidas', () => {
    const r = validate(loginSchema, { email: 'paciente@renoveja.com', password: 'senha123' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('paciente@renoveja.com');
  });

  it('rejeita email em branco', () => {
    const r = validate(loginSchema, { email: '', password: 'senha123' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.firstError).toMatch(/email/i);
  });

  it('rejeita email mal-formado', () => {
    const r = validate(loginSchema, { email: 'nao-é-um-email', password: 'senha123' });
    expect(r.success).toBe(false);
  });

  it('rejeita senha em branco', () => {
    const r = validate(loginSchema, { email: 'a@b.com', password: '' });
    expect(r.success).toBe(false);
  });

  it('normaliza email para minúsculas', () => {
    const r = validate(loginSchema, { email: '  USER@DOMINIO.COM  ', password: 'x' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('user@dominio.com');
  });
});

// ─── Fluxo: Reset de senha ────────────────────────────────────

describe('Fluxo de Reset de Senha', () => {
  it('aceita senhas iguais e >= 8 chars', () => {
    const r = validate(resetPasswordSchema, { newPassword: 'NovaSenha1!', confirmPassword: 'NovaSenha1!' });
    expect(r.success).toBe(true);
  });

  it('rejeita senha < 8 chars', () => {
    const r = validate(resetPasswordSchema, { newPassword: 'abc', confirmPassword: 'abc' });
    expect(r.success).toBe(false);
  });

  it('rejeita senhas diferentes', () => {
    const r = validate(resetPasswordSchema, { newPassword: 'SenhaCorreta1', confirmPassword: 'SenhaErrada1' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.firstError).toMatch(/coincidem/i);
  });
});

// ─── Fluxo: Estado de pedido (UiState) ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const req = (status: string, extra: Record<string, unknown> = {}): any =>
  ({ id: `id-${status}`, status, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...extra });

describe('Fluxo de Pedido — regras de negócio críticas', () => {
  it('pedido submetido → needs_action', () => {
    expect(getRequestUiState(req('submitted')).uiState).toBe('needs_action');
  });

  it('pedido pending (legado) → needs_action', () => {
    expect(getRequestUiState(req('pending')).uiState).toBe('needs_action');
  });

  it('pedido approved_pending_payment → needs_action (fluxo sem pagamento)', () => {
    expect(getRequestUiState(req('approved_pending_payment')).uiState).toBe('needs_action');
  });

  it('pedido paid → retorna uiState com colorKey válido', () => {
    const ui = getRequestUiState(req('paid'));
    expect(['action', 'success', 'waiting', 'historical']).toContain(ui.colorKey);
    expect(ui.label).toBeTruthy();
  });

  it('pedido rejected/cancelled → historical (status desconhecido cai em historical)', () => {
    expect(getRequestUiState(req('rejected')).uiState).toBe('historical');
    expect(getRequestUiState(req('cancelled')).uiState).toBe('historical');
  });

  it('status desconhecido → historical (safe default)', () => {
    expect(getRequestUiState(req('status_inexistente')).uiState).toBe('historical');
  });

  it('isSignedOrDelivered: true para signed e delivered', () => {
    expect(isSignedOrDelivered(req('signed'))).toBe(true);
    expect(isSignedOrDelivered(req('delivered'))).toBe(true);
    expect(isSignedOrDelivered(req('paid'))).toBe(false);
  });
});

// ─── Fluxo: Onboarding ───────────────────────────────────────

describe('Fluxo de Onboarding', () => {
  beforeEach(() => {
    // Limpar store entre testes
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it('retorna false na primeira instalação', async () => {
    const done = await isOnboardingDone();
    expect(done).toBe(false);
  });

  it('retorna true após markOnboardingDone', async () => {
    await markOnboardingDone();
    const done = await isOnboardingDone();
    expect(done).toBe(true);
  });

  it('retorna true em caso de erro de leitura (não bloquear usuário)', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));
    const done = await isOnboardingDone();
    expect(done).toBe(true); // safe default
  });
});
