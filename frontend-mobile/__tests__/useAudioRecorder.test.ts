/**
 * useAudioRecorder.test.ts
 *
 * Verifica o setup crítico de áudio no Android e o ciclo de vida da gravação.
 * O bug histórico (shouldDuckAndroid: false) travava o áudio em dispositivos físicos
 * Android quando a gravação iniciava enquanto o Daily.co estava ativo.
 */

import { renderHook, act } from '@testing-library/react';

// ── Mocks de módulos nativos ──────────────────────────────────────────────────

const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockRequestPermissionsAsync = jest.fn();
const mockCreateAsync = jest.fn();
const mockStopAndUnloadAsync = jest.fn().mockResolvedValue(undefined);
const mockGetStatusAsync = jest.fn().mockResolvedValue({ isRecording: true });
const mockGetURI = jest.fn().mockReturnValue('file://chunk.m4a');

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: mockSetAudioModeAsync,
    requestPermissionsAsync: mockRequestPermissionsAsync,
    Recording: {
      createAsync: mockCreateAsync,
    },
  },
  InterruptionModeIOS: { DoNotMix: 'DoNotMix' },
  InterruptionModeAndroid: { DuckOthers: 'DuckOthers' },
}));

const mockSendChunk = jest.fn().mockResolvedValue(undefined);
const mockCycleChunk = jest.fn().mockResolvedValue(undefined);
const mockResetCounters = jest.fn();
const mockSetSecondsUntilNextChunk = jest.fn();

jest.mock('../hooks/useAudioChunking', () => ({
  useAudioChunking: () => ({
    chunksSent: 0,
    chunksFailed: 0,
    lastChunkError: null,
    secondsUntilNextChunk: 0,
    setSecondsUntilNextChunk: mockSetSecondsUntilNextChunk,
    sendChunk: mockSendChunk,
    cycleChunk: mockCycleChunk,
    resetCounters: mockResetCounters,
  }),
  CHUNK_DURATION_MS: 15_000,
  RECORDING_OPTIONS: {},
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'android' },
}));

import { useAudioRecorder } from '../hooks/useAudioRecorder';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe('useAudioRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
    const mockRecording = {
      stopAndUnloadAsync: mockStopAndUnloadAsync,
      getStatusAsync: mockGetStatusAsync,
      getURI: mockGetURI,
    };
    mockCreateAsync.mockResolvedValue({ recording: mockRecording });
  });

  describe('Audio.setAudioModeAsync — configuração Android', () => {
    it('chama setAudioModeAsync com shouldDuckAndroid: true ao iniciar', async () => {
      const { result } = renderHook(() => useAudioRecorder('req-123'));

      await act(async () => {
        await result.current.start();
      });

      expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
        expect.objectContaining({ shouldDuckAndroid: true }),
      );
    });

    it('NUNCA passa shouldDuckAndroid: false (bug histórico)', async () => {
      const { result } = renderHook(() => useAudioRecorder('req-123'));

      await act(async () => {
        await result.current.start();
      });

      const calls = mockSetAudioModeAsync.mock.calls;
      for (const [config] of calls) {
        expect(config?.shouldDuckAndroid).not.toBe(false);
      }
    });

    it('configura interruptionModeAndroid como DuckOthers', async () => {
      const { result } = renderHook(() => useAudioRecorder('req-123'));

      await act(async () => {
        await result.current.start();
      });

      expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
        expect.objectContaining({ interruptionModeAndroid: 'DuckOthers' }),
      );
    });

    it('habilita allowsRecordingIOS ao iniciar', async () => {
      const { result } = renderHook(() => useAudioRecorder('req-123'));

      await act(async () => {
        await result.current.start();
      });

      expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
        expect.objectContaining({ allowsRecordingIOS: true }),
      );
    });

    it('desabilita allowsRecordingIOS ao parar', async () => {
      const { result } = renderHook(() => useAudioRecorder('req-123'));

      await act(async () => {
        await result.current.start();
        await result.current.stop();
      });

      const stopCall = mockSetAudioModeAsync.mock.calls.find(
        ([cfg]) => cfg?.allowsRecordingIOS === false,
      );
      expect(stopCall).toBeDefined();
    });
  });

  describe('ciclo de vida', () => {
    it('retorna isRecording: false no estado inicial', () => {
      const { result } = renderHook(() => useAudioRecorder('req-123'));
      expect(result.current.isRecording).toBe(false);
    });

    it('retorna isRecording: true após start bem-sucedido', async () => {
      const { result } = renderHook(() => useAudioRecorder('req-123'));

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.isRecording).toBe(true);
    });

    it('retorna isRecording: false após stop', async () => {
      const { result } = renderHook(() => useAudioRecorder('req-123'));

      await act(async () => {
        await result.current.start();
        await result.current.stop();
      });

      expect(result.current.isRecording).toBe(false);
    });

    it('retorna false e seta error quando permissão é negada', async () => {
      mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: false });

      const { result } = renderHook(() => useAudioRecorder('req-123'));
      let startResult: boolean = true;

      await act(async () => {
        startResult = await result.current.start();
      });

      expect(startResult).toBe(false);
      expect(result.current.error).toContain('microfone');
    });

    it('não inicia segunda gravação se já está gravando', async () => {
      const { result } = renderHook(() => useAudioRecorder('req-123'));

      await act(async () => {
        await result.current.start();
      });

      const createCallsBefore = mockCreateAsync.mock.calls.length;

      await act(async () => {
        await result.current.start();
      });

      expect(mockCreateAsync.mock.calls.length).toBe(createCallsBefore);
    });

    it('reseta contadores ao iniciar nova sessão', async () => {
      const { result } = renderHook(() => useAudioRecorder('req-123'));

      await act(async () => {
        await result.current.start();
      });

      expect(mockResetCounters).toHaveBeenCalledTimes(1);
    });
  });
});
