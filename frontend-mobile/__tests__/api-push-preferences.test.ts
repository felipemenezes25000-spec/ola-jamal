/**
 * api-push-preferences.test.ts
 * Destino: frontend-mobile/__tests__/api-push-preferences.test.ts
 */

const mockGet = jest.fn();
const mockPut = jest.fn();

jest.mock('../lib/api-client', () => ({
  apiClient: { get: mockGet, put: mockPut },
}));

import { getPushPreferences, updatePushPreferences } from '../lib/api-push-preferences';

const MOCK_PREFS = {
  requestsEnabled: true,
  consultationsEnabled: false,
  remindersEnabled: true,
  timezone: 'America/Sao_Paulo',
};

beforeEach(() => jest.clearAllMocks());

describe('getPushPreferences', () => {
  it('faz GET no endpoint correto', async () => {
    mockGet.mockResolvedValueOnce(MOCK_PREFS);

    const result = await getPushPreferences();

    expect(mockGet).toHaveBeenCalledWith('/api/push-tokens/preferences');
    expect(result.timezone).toBe('America/Sao_Paulo');
  });

  it('propaga erro de rede', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'));
    await expect(getPushPreferences()).rejects.toThrow('network');
  });
});

describe('updatePushPreferences', () => {
  it('faz PUT com as preferências parciais', async () => {
    mockPut.mockResolvedValueOnce({ ...MOCK_PREFS, consultationsEnabled: true });

    const result = await updatePushPreferences({ consultationsEnabled: true });

    expect(mockPut).toHaveBeenCalledWith(
      '/api/push-tokens/preferences',
      { consultationsEnabled: true }
    );
    expect(result.consultationsEnabled).toBe(true);
  });

  it('aceita atualização de apenas timezone', async () => {
    mockPut.mockResolvedValueOnce({ ...MOCK_PREFS, timezone: 'America/Manaus' });

    await updatePushPreferences({ timezone: 'America/Manaus' });

    expect(mockPut).toHaveBeenCalledWith(
      '/api/push-tokens/preferences',
      { timezone: 'America/Manaus' }
    );
  });

  it('propaga erro', async () => {
    mockPut.mockRejectedValueOnce(new Error('forbidden'));
    await expect(updatePushPreferences({})).rejects.toThrow('forbidden');
  });
});
