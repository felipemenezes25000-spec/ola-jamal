import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyReceita } from './verify';

describe('verifyReceita', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deve retornar error quando payload vazio', async () => {
    const result = await verifyReceita({ id: '', code: '' });

    expect(result).toEqual({
      status: 'error',
      message: 'ID e código são obrigatórios.',
    });
  });

  it('deve retornar invalid quando API retorna isValid false', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          isValid: false,
          reason: 'INVALID_CODE',
        }),
    });

    const result = await verifyReceita({ id: '550e8400-e29b-41d4-a716-446655440000', code: '000000' });

    expect(result).toEqual({
      status: 'invalid',
      reason: 'INVALID_CODE',
      message: 'Código inválido.',
    });
  });

  it('deve retornar valid quando API retorna isValid true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          isValid: true,
          issuedAt: '2024-01-15',
          signedAt: '2024-01-15T10:00:00',
          patientName: 'João',
          doctorName: 'Dr. Silva',
          doctorCrm: '12345',
          downloadUrl: 'https://example.com/pdf',
        }),
    });

    const result = await verifyReceita({ id: '550e8400-e29b-41d4-a716-446655440000', code: '123456' });

    expect(result).toEqual({
      status: 'valid',
      data: {
        status: 'valid',
        issuedAt: '2024-01-15',
        signedAt: '2024-01-15T10:00:00',
        patientName: 'João',
        doctorName: 'Dr. Silva',
        doctorCrm: '12345',
        downloadUrl: 'https://example.com/pdf',
        wasDispensed: false,
      },
    });
  });
});
