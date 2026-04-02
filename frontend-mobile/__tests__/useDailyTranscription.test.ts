/**
 * @file useDailyTranscription.test.ts
 * Caminho destino: frontend-mobile/__tests__/useDailyTranscription.test.ts
 *
 * Cobre: useDailyTranscription
 * Estratégia: ref fake do DailyCall, mock de transcribeTextChunk.
 * Testa: inicialização, início de transcrição, handleMessage (speaker mapping),
 *        guardas (consultationActive, isDoctor), fallback Deepgram, stop().
 */

import { renderHook, act } from '@testing-library/react-native';
import { MutableRefObject } from 'react';
import { useDailyTranscription } from '../hooks/useDailyTranscription';

// Flush microtask queue (await Promise.resolve alone is not enough for chained awaits)
const flushMicrotasks = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockTranscribeTextChunk = jest.fn().mockResolvedValue(undefined);

jest.mock('../lib/api', () => ({
  transcribeTextChunk: (...args: unknown[]) => mockTranscribeTextChunk(...args),
}));

// ─── Fake DailyCall ────────────────────────────────────────────────────────

type EventHandler = (event: Record<string, unknown>) => void;

function makeFakeCall(localSessionId = 'local-session-abc') {
  const handlers: Record<string, EventHandler> = {};

  const fakeCall = {
    startTranscription: jest.fn().mockResolvedValue(undefined),
    stopTranscription: jest.fn().mockResolvedValue(undefined),
    on: jest.fn((event: string, handler: EventHandler) => {
      handlers[event] = handler;
    }),
    off: jest.fn(),
    participants: jest.fn(() => ({
      local: { session_id: localSessionId },
    })),
    _fire: (event: string, data: Record<string, unknown>) => {
      handlers[event]?.(data);
    },
  };

  return fakeCall;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeRef<T>(value: T): MutableRefObject<T> {
  return { current: value };
}

const baseOptions = {
  requestId: 'req-456',
  isDoctor: true,
  localSessionId: 'local-session-abc',
  callJoined: true,
  consultationActive: true,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Testes ───────────────────────────────────────────────────────────────

describe('useDailyTranscription — estado inicial', () => {
  it('retorna isTranscribing=false e error=null inicialmente', async () => {
    const fakeCall = makeFakeCall();
    const callRef = makeRef(fakeCall as unknown as null);

    const { result } = renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    expect(result.current.isTranscribing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.stop).toBe('function');

    // Flush async useEffect (startTranscription) to avoid act() warning
    await flushMicrotasks();
  });
});

describe('useDailyTranscription — início de transcrição (médico)', () => {
  it('chama startTranscription quando isDoctor=true e callJoined=true', async () => {
    const fakeCall = makeFakeCall();
    const callRef = makeRef(fakeCall as unknown as null);

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    // startTranscription é chamada no useEffect
    await flushMicrotasks();

    expect(fakeCall.startTranscription).toHaveBeenCalledWith({ language: 'pt-BR' });
  });

  it('NÃO inicia transcrição quando isDoctor=false', () => {
    const fakeCall = makeFakeCall();
    const callRef = makeRef(fakeCall as unknown as null);

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef, isDoctor: false })
    );

    expect(fakeCall.startTranscription).not.toHaveBeenCalled();
  });

  it('NÃO inicia transcrição quando callJoined=false', () => {
    const fakeCall = makeFakeCall();
    const callRef = makeRef(fakeCall as unknown as null);

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef, callJoined: false })
    );

    expect(fakeCall.startTranscription).not.toHaveBeenCalled();
  });

  it('chama onTranscriptionFailed quando startTranscription rejeita', async () => {
    const fakeCall = makeFakeCall();
    fakeCall.startTranscription.mockRejectedValueOnce(new Error('deepgram unavailable'));
    const callRef = makeRef(fakeCall as unknown as null);
    const onTranscriptionFailed = jest.fn();

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef, onTranscriptionFailed })
    );

    await flushMicrotasks();

    expect(onTranscriptionFailed).toHaveBeenCalled();
  });
});

describe('useDailyTranscription — handleMessage (mapeamento de speaker)', () => {
  it('envia ao backend com speaker=medico quando evento vem do local (isDoctor=true)', async () => {
    const fakeCall = makeFakeCall('local-session-abc');
    const callRef = makeRef(fakeCall as unknown as null);

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-message', {
        text: 'Bom dia, como posso ajudar?',
        participantId: 'local-session-abc', // local = médico
      });
    });

    await flushMicrotasks();

    expect(mockTranscribeTextChunk).toHaveBeenCalledWith(
      'req-456',
      'Bom dia, como posso ajudar?',
      'medico',
      undefined,
    );
  });

  it('envia com speaker=paciente quando evento vem do participante remoto', async () => {
    const fakeCall = makeFakeCall('local-session-abc');
    const callRef = makeRef(fakeCall as unknown as null);

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-message', {
        text: 'Estou sentindo dor de cabeça.',
        participantId: 'remote-session-xyz', // remoto = paciente
      });
    });

    await flushMicrotasks();

    expect(mockTranscribeTextChunk).toHaveBeenCalledWith(
      'req-456',
      'Estou sentindo dor de cabeça.',
      'paciente',
      undefined,
    );
  });

  it('inclui startTimeSeconds quando o evento traz start', async () => {
    const fakeCall = makeFakeCall('local-session-abc');
    const callRef = makeRef(fakeCall as unknown as null);

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-message', {
        text: 'Texto com timestamp.',
        participantId: 'local-session-abc',
        start: 12.5,
      });
    });

    await flushMicrotasks();

    expect(mockTranscribeTextChunk).toHaveBeenCalledWith(
      'req-456',
      'Texto com timestamp.',
      'medico',
      12.5,
    );
  });

  it('ignora evento quando texto está vazio', async () => {
    const fakeCall = makeFakeCall();
    const callRef = makeRef(fakeCall as unknown as null);

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-message', {
        text: '   ',
        participantId: 'local-session-abc',
      });
    });

    await flushMicrotasks();

    expect(mockTranscribeTextChunk).not.toHaveBeenCalled();
  });

  it('ignora evento sem participantId (ambíguo)', async () => {
    const fakeCall = makeFakeCall();
    const callRef = makeRef(fakeCall as unknown as null);

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-message', {
        text: 'Texto sem participantId.',
        // sem participantId
      });
    });

    await flushMicrotasks();

    expect(mockTranscribeTextChunk).not.toHaveBeenCalled();
  });

  it('NÃO envia ao backend quando consultationActive=false', async () => {
    const fakeCall = makeFakeCall('local-session-abc');
    const callRef = makeRef(fakeCall as unknown as null);

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef, consultationActive: false })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-message', {
        text: 'Consulta ainda não iniciou.',
        participantId: 'local-session-abc',
      });
    });

    await flushMicrotasks();

    expect(mockTranscribeTextChunk).not.toHaveBeenCalled();
  });
});

describe('useDailyTranscription — callbacks de envio', () => {
  it('chama onSendSuccess após envio bem-sucedido', async () => {
    const fakeCall = makeFakeCall('local-session-abc');
    const callRef = makeRef(fakeCall as unknown as null);
    const onSendSuccess = jest.fn();

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef, onSendSuccess })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-message', {
        text: 'Texto enviado com sucesso.',
        participantId: 'local-session-abc',
      });
    });

    await flushMicrotasks();

    expect(onSendSuccess).toHaveBeenCalled();
  });

  it('chama onSendError quando transcribeTextChunk rejeita', async () => {
    const fakeCall = makeFakeCall('local-session-abc');
    const callRef = makeRef(fakeCall as unknown as null);
    const onSendError = jest.fn();

    mockTranscribeTextChunk.mockRejectedValueOnce(new Error('network error'));

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef, onSendError })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-message', {
        text: 'Texto que vai falhar.',
        participantId: 'local-session-abc',
      });
    });

    await flushMicrotasks();

    expect(onSendError).toHaveBeenCalledWith('network error');
  });
});

describe('useDailyTranscription — eventos de controle', () => {
  it('atualiza isTranscribing=true em transcription-started', async () => {
    const fakeCall = makeFakeCall();
    const callRef = makeRef(fakeCall as unknown as null);

    const { result } = renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-started', {});
    });

    expect(result.current.isTranscribing).toBe(true);
  });

  it('atualiza isTranscribing=false em transcription-stopped', async () => {
    const fakeCall = makeFakeCall();
    const callRef = makeRef(fakeCall as unknown as null);

    const { result } = renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-started', {});
      fakeCall._fire('transcription-stopped', {});
    });

    expect(result.current.isTranscribing).toBe(false);
  });

  it('chama onTranscriptionFailed em transcription-error', async () => {
    const fakeCall = makeFakeCall();
    const callRef = makeRef(fakeCall as unknown as null);
    const onTranscriptionFailed = jest.fn();

    renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef, onTranscriptionFailed })
    );

    await flushMicrotasks();

    act(() => {
      fakeCall._fire('transcription-error', {});
    });

    expect(onTranscriptionFailed).toHaveBeenCalled();
  });
});

describe('useDailyTranscription — stop()', () => {
  it('chama stopTranscription no call e atualiza isTranscribing=false', async () => {
    const fakeCall = makeFakeCall();
    const callRef = makeRef(fakeCall as unknown as null);

    const { result } = renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    await flushMicrotasks();

    await act(async () => {
      await result.current.stop();
    });

    expect(fakeCall.stopTranscription).toHaveBeenCalled();
    expect(result.current.isTranscribing).toBe(false);
  });

  it('não crasha ao chamar stop() com callRef.current null', async () => {
    const callRef = makeRef(null);

    const { result } = renderHook(() =>
      useDailyTranscription({ ...baseOptions, callRef })
    );

    await expect(
      act(async () => { await result.current.stop(); })
    ).resolves.not.toThrow();
  });
});
