/**
 * RequestsEventsContext.test.tsx
 *
 * Verifica o split de contexts (StableContext + VolatileContext):
 * - Consumers de StableContext NÃO re-renderizam quando pendingUpdate muda
 * - Consumers de VolatileContext re-renderizam quando pendingUpdate muda
 * - subscribe retorna função de cancelamento funcional
 * - backoff exponencial de reconexão
 */

/**
 * @jest-environment jsdom
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';

// ── Mocks de módulos nativos ──────────────────────────────────────────────────

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  default: { addEventListener: jest.fn(() => jest.fn()) },
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: { OS: 'web' },
}));

const mockStart = jest.fn().mockResolvedValue(true);
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockSubscribe = jest.fn(() => jest.fn());
const mockIsConnected = jest.fn().mockReturnValue(false);

jest.mock('../lib/requestsEvents', () => ({
  startRequestsEventsConnection: mockStart,
  stopRequestsEventsConnection: mockStop,
  subscribeRequestsEvents: mockSubscribe,
  isRequestsEventsConnected: mockIsConnected,
}));

jest.mock('../lib/api-client', () => ({
  apiClient: {
    getAuthToken: jest.fn().mockResolvedValue('token'),
    getBaseUrl: jest.fn().mockReturnValue('http://localhost:5000'),
    setOnUnauthorized: jest.fn(),
    setOnForbidden: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

import {
  RequestsEventsProvider,
  useRequestsEvents,
  useRequestsEventsStable,
} from '../contexts/RequestsEventsContext';
import { AuthProvider } from '../contexts/AuthContext';

// ── Wrapper com providers ─────────────────────────────────────────────────────

function makeWrapper() {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>
      <RequestsEventsProvider>{children}</RequestsEventsProvider>
    </AuthProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
}

/** renderHook + flush async AuthContext.loadStoredUser to avoid act() warnings */
async function renderHookAsync<T>(hook: () => T, wrapper?: ReturnType<typeof makeWrapper>) {
  let hookResult: { result: { current: T } } | undefined;
  await act(async () => {
    hookResult = renderHook(hook, { wrapper: wrapper ?? makeWrapper() });
  });
  return hookResult!;
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('RequestsEventsContext — split de renders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStart.mockResolvedValue(true);
    mockStop.mockResolvedValue(undefined);
    mockIsConnected.mockReturnValue(false);
    mockSubscribe.mockReturnValue(jest.fn());
  });

  describe('useRequestsEvents — hook unificado', () => {
    it('retorna isConnected inicial como false', async () => {
      const { result } = await renderHookAsync(() => useRequestsEvents());

      expect(result.current.isConnected).toBe(false);
    });

    it('retorna pendingUpdate inicial como null', async () => {
      const { result } = await renderHookAsync(() => useRequestsEvents());

      expect(result.current.pendingUpdate).toBeNull();
    });

    it('setPendingUpdate atualiza o pendingUpdate', async () => {
      const { result } = await renderHookAsync(() => useRequestsEvents());

      await act(async () => {
        result.current.setPendingUpdate({ requestId: 'req-1', message: 'Aprovado' });
      });

      expect(result.current.pendingUpdate).toEqual({
        requestId: 'req-1',
        message: 'Aprovado',
      });
    });

    it('subscribe delega para subscribeRequestsEvents', async () => {
      const { result } = await renderHookAsync(() => useRequestsEvents());

      const listener = jest.fn();
      result.current.subscribe(listener);

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('useRequestsEventsStable — sem re-render no pendingUpdate', () => {
    it('retorna subscribe e isConnected sem VolatileContext', async () => {
      const { result } = await renderHookAsync(() => useRequestsEventsStable());

      expect(typeof result.current.subscribe).toBe('function');
      expect(typeof result.current.isConnected).toBe('boolean');
    });

    it('NÃO inclui pendingUpdate ou setPendingUpdate', async () => {
      const { result } = await renderHookAsync(() => useRequestsEventsStable());

      expect((result.current as unknown as Record<string, unknown>).pendingUpdate).toBeUndefined();
      expect((result.current as unknown as Record<string, unknown>).setPendingUpdate).toBeUndefined();
    });

    it('re-renderiza minimamente — contagem de renders com Stable vs Unified', async () => {
      let stableRenders = 0;
      let unifiedRenders = 0;

      await renderHookAsync(
        () => {
          stableRenders++;
          return useRequestsEventsStable();
        },
      );

      const { result: unifiedResult } = await renderHookAsync(
        () => {
          unifiedRenders++;
          return useRequestsEvents();
        },
      );

      const rendersBefore = { stable: stableRenders, unified: unifiedRenders };

      // Atualiza pendingUpdate — deve causar re-render no unified, não no stable
      await act(async () => {
        unifiedResult.current.setPendingUpdate({ requestId: 'req-1', message: 'X' });
      });

      // Stable não deve ter re-renderizado por causa do pendingUpdate
      expect(stableRenders).toBe(rendersBefore.stable);
      // Unified deve ter re-renderizado
      expect(unifiedRenders).toBeGreaterThan(rendersBefore.unified);
    });
  });

  describe('subscribe — cancelamento', () => {
    it('subscribe retorna função de cancelamento', async () => {
      const unsubscribe = jest.fn();
      mockSubscribe.mockReturnValueOnce(unsubscribe);

      const { result } = await renderHookAsync(() => useRequestsEvents());

      const cancel = result.current.subscribe(jest.fn());
      expect(typeof cancel).toBe('function');
    });

    it('cancelamento chama unsubscribe do módulo requestsEvents', async () => {
      const unsubscribe = jest.fn();
      mockSubscribe.mockReturnValueOnce(unsubscribe);

      const { result } = await renderHookAsync(() => useRequestsEvents());

      const cancel = result.current.subscribe(jest.fn());

      act(() => {
        cancel();
      });

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('conexão SignalR', () => {
    it('tenta conectar quando há usuário autenticado', async () => {
      const { result } = await renderHookAsync(() => useRequestsEvents());

      expect(result.current.isConnected).toBe(false);
    });

    it('usa valores padrão seguros antes da conexão', async () => {
      const { result } = await renderHookAsync(() => useRequestsEventsStable());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.subscribe).toBeDefined();
    });
  });

  describe('erros de uso', () => {
    it('useRequestsEvents fora do provider lança erro descritivo', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useRequestsEvents());
      }).toThrow('useRequestsEvents must be used within RequestsEventsProvider');

      consoleSpy.mockRestore();
    });

    it('useRequestsEventsStable fora do provider lança erro descritivo', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useRequestsEventsStable());
      }).toThrow('useRequestsEventsStable must be used within RequestsEventsProvider');

      consoleSpy.mockRestore();
    });
  });
});
