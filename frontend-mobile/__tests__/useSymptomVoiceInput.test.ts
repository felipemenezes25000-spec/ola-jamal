/**
 * useSymptomVoiceInput.test.ts
 *
 * Testa o ciclo de vida do hook de gravação de voz para sintomas:
 * - Permissão de microfone
 * - Início/parada de gravação
 * - Transcrição e retorno de texto
 * - Cancelamento
 * - Tratamento de erros
 */

import { renderHook, act } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────

const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockRequestPermissionsAsync = jest.fn();
const mockCreateAsync = jest.fn();
const mockStopAndUnloadAsync = jest.fn().mockResolvedValue(undefined);
const mockGetStatusAsync = jest.fn().mockResolvedValue({ isRecording: true });
const mockGetURI = jest.fn().mockReturnValue('file://symptom.m4a');

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: mockSetAudioModeAsync,
    requestPermissionsAsync: mockRequestPermissionsAsync,
    Recording: {
      createAsync: mockCreateAsync,
    },
  },
  InterruptionModeIOS: { MixWithOthers: 'MixWithOthers' },
  InterruptionModeAndroid: { DuckOthers: 'DuckOthers' },
}));

const mockGetInfoAsync = jest.fn();
const mockDeleteAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

const mockTranscribeSymptomAudio = jest.fn();

jest.mock('../lib/api-speech', () => ({
  transcribeSymptomAudio: (...args: unknown[]) => mockTranscribeSymptomAudio(...args),
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'android' },
}));

import { useSymptomVoiceInput } from '../hooks/useSymptomVoiceInput';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe('useSymptomVoiceInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
    const mockRecording = {
      stopAndUnloadAsync: mockStopAndUnloadAsync,
      getStatusAsync: mockGetStatusAsync,
      getURI: mockGetURI,
    };
    mockCreateAsync.mockResolvedValue({ recording: mockRecording });
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 5000 });
    mockTranscribeSymptomAudio.mockResolvedValue({
      transcribed: true,
      raw: 'eu to com dor de cabeça ãh faz umas duas semanas',
      polished: 'Estou com dor de cabeça há duas semanas.',
      text: 'Estou com dor de cabeça há duas semanas.',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('estado inicial', () => {
    it('retorna isRecording: false', () => {
      const { result } = renderHook(() => useSymptomVoiceInput());
      expect(result.current.isRecording).toBe(false);
    });

    it('retorna isTranscribing: false', () => {
      const { result } = renderHook(() => useSymptomVoiceInput());
      expect(result.current.isTranscribing).toBe(false);
    });

    it('retorna durationSeconds: 0', () => {
      const { result } = renderHook(() => useSymptomVoiceInput());
      expect(result.current.durationSeconds).toBe(0);
    });

    it('retorna error: null', () => {
      const { result } = renderHook(() => useSymptomVoiceInput());
      expect(result.current.error).toBeNull();
    });
  });

  describe('startRecording', () => {
    it('pede permissão de microfone', async () => {
      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('configura áudio com alta qualidade (44100 Hz)', async () => {
      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          allowsRecordingIOS: true,
          shouldDuckAndroid: true,
        }),
      );
    });

    it('cria Recording e seta isRecording: true', async () => {
      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(mockCreateAsync).toHaveBeenCalledTimes(1);
      expect(result.current.isRecording).toBe(true);
    });

    it('seta error e não grava quando permissão negada', async () => {
      mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: false });
      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.error).toContain('microfone');
      expect(mockCreateAsync).not.toHaveBeenCalled();
    });

    it('incrementa durationSeconds a cada segundo', async () => {
      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.durationSeconds).toBe(0);

      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.durationSeconds).toBe(3);
    });
  });

  describe('stopAndTranscribe', () => {
    it('para gravação, envia áudio e retorna texto polido', async () => {
      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      let text: string | null = null;
      await act(async () => {
        text = await result.current.stopAndTranscribe('Exame laboratorial');
      });

      expect(text).toBe('Estou com dor de cabeça há duas semanas.');
      expect(result.current.isRecording).toBe(false);
      expect(result.current.isTranscribing).toBe(false);
      expect(mockStopAndUnloadAsync).toHaveBeenCalled();
      expect(mockTranscribeSymptomAudio).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: 'file://symptom.m4a',
          type: 'audio/mp4',
        }),
        'Exame laboratorial',
      );
    });

    it('deleta arquivo temporário após transcrição', async () => {
      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      await act(async () => {
        await result.current.stopAndTranscribe();
      });

      expect(mockDeleteAsync).toHaveBeenCalledWith('file://symptom.m4a', { idempotent: true });
    });

    it('retorna null e seta error quando arquivo é muito pequeno', async () => {
      mockGetInfoAsync.mockResolvedValueOnce({ exists: true, size: 500 });

      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      let text: string | null = null;
      await act(async () => {
        text = await result.current.stopAndTranscribe();
      });

      expect(text).toBeNull();
      expect(result.current.error).toContain('curta');
      expect(mockTranscribeSymptomAudio).not.toHaveBeenCalled();
    });

    it('retorna null quando nenhuma fala detectada', async () => {
      mockTranscribeSymptomAudio.mockResolvedValueOnce({
        transcribed: false,
        raw: '',
        polished: '',
        text: '',
      });

      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      let text: string | null = null;
      await act(async () => {
        text = await result.current.stopAndTranscribe();
      });

      expect(text).toBeNull();
      expect(result.current.error).toContain('fala');
    });

    it('retorna null sem recording quando não está gravando', async () => {
      const { result } = renderHook(() => useSymptomVoiceInput());

      let text: string | null = 'should-be-null';
      await act(async () => {
        text = await result.current.stopAndTranscribe();
      });

      expect(text).toBeNull();
      expect(result.current.error).toContain('gravação');
    });

    it('restaura audio mode após transcrição', async () => {
      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      mockSetAudioModeAsync.mockClear();

      await act(async () => {
        await result.current.stopAndTranscribe();
      });

      expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
        expect.objectContaining({ allowsRecordingIOS: false }),
      );
    });

    it('reseta durationSeconds após transcrição', async () => {
      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.durationSeconds).toBe(5);

      await act(async () => {
        await result.current.stopAndTranscribe();
      });

      expect(result.current.durationSeconds).toBe(0);
    });
  });

  describe('cancelRecording', () => {
    it('para gravação sem transcrever', async () => {
      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(true);

      await act(async () => {
        await result.current.cancelRecording();
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.isTranscribing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockTranscribeSymptomAudio).not.toHaveBeenCalled();
    });
  });

  describe('tratamento de erros', () => {
    it('trata erro de API na transcrição', async () => {
      mockTranscribeSymptomAudio.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      let text: string | null = null;
      await act(async () => {
        text = await result.current.stopAndTranscribe();
      });

      expect(text).toBeNull();
      expect(result.current.error).toBe('Network error');
      expect(result.current.isTranscribing).toBe(false);
    });

    it('trata erro ao criar Recording', async () => {
      mockCreateAsync.mockRejectedValueOnce(new Error('Microphone busy'));

      const { result } = renderHook(() => useSymptomVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.error).toBe('Microphone busy');
    });
  });
});
