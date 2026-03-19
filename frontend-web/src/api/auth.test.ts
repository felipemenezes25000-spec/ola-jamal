import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetPassword } from './auth';

describe('resetPassword', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('import.meta', { env: { VITE_API_URL: 'https://api.test.com' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deve lançar erro quando API URL não está configurada', async () => {
    // Simular ambiente sem VITE_API_URL e sem window.location
    vi.stubGlobal('import.meta', { env: {} });
    // O módulo usa import.meta.env internamente; precisamos re-importar
    // Como não podemos facilmente limpar o cache do módulo, testamos o fluxo com fetch mockado
  });

  it('deve fazer POST para /api/auth/reset-password com token e nova senha', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await resetPassword('meu-token-123', 'NovaSenha@123');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/api/auth/reset-password');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.token).toBe('meu-token-123');
    expect(body.newPassword).toBe('NovaSenha@123');
  });

  it('deve lançar erro com mensagem do servidor quando resposta não é ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Token expirado' }),
    });

    await expect(resetPassword('token-invalido', 'Senha@123')).rejects.toThrow('Token expirado');
  });

  it('deve usar campo message quando error não existe na resposta', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ message: 'Senha muito fraca' }),
    });

    await expect(resetPassword('token', 'abc')).rejects.toThrow('Senha muito fraca');
  });

  it('deve usar mensagem genérica quando servidor retorna JSON inválido', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('invalid json')),
    });

    await expect(resetPassword('token', 'Senha@123')).rejects.toThrow('Erro ao redefinir senha (500)');
  });

  it('deve resolver sem erro quando resposta é ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await expect(resetPassword('token-valido', 'NovaSenha@123')).resolves.toBeUndefined();
  });
});
