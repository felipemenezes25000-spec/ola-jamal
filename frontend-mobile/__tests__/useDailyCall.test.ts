/**
 * useDailyCall.test.ts — Hook orquestrador Daily.co
 * Destino: frontend-mobile/__tests__/useDailyCall.test.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDailyCall } from '../hooks/useDailyCall';

const mockJoin = jest.fn();
const mockLeave = jest.fn();
const mockCallRef = { current: null as unknown };

jest.mock('../hooks/useDailyJoin', () => ({
  useDailyJoin: jest.fn(() => ({
    callRef: mockCallRef,
    callState: 'idle',
    localParticipant: null,
    remoteParticipant: null,
    errorMessage: null,
    join: mockJoin,
    leave: mockLeave,
  })),
}));

jest.mock('../hooks/useQualityMonitor', () => ({
  useQualityMonitor: jest.fn(() => ({ quality: 'good' })),
}));

const makeFakeCall = () => ({
  setLocalAudio: jest.fn().mockResolvedValue(undefined),
  setLocalVideo: jest.fn().mockResolvedValue(undefined),
  cycleCamera: jest.fn().mockResolvedValue(undefined),
});

const defaultOptions = {
  roomUrl: 'https://renove.daily.co/consult-test',
  token: 'mock-token',
};

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe('useDailyCall — estado inicial', () => {
  it('retorna callState idle e participantes nulos', () => {
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    expect(result.current.callState).toBe('idle');
    expect(result.current.localParticipant).toBeNull();
    expect(result.current.remoteParticipant).toBeNull();
  });

  it('retorna isMuted=false, isCameraOff=false, isFrontCamera=true', () => {
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    expect(result.current.isMuted).toBe(false);
    expect(result.current.isCameraOff).toBe(false);
    expect(result.current.isFrontCamera).toBe(true);
  });

  it('expõe callRef, join, leave, quality', () => {
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    expect(result.current.callRef).toBeDefined();
    expect(typeof result.current.join).toBe('function');
    expect(typeof result.current.leave).toBe('function');
    expect(result.current.quality).toBe('good');
  });
});

describe('useDailyCall — toggleMute', () => {
  it('chama setLocalAudio(false) e atualiza isMuted=true', async () => {
    const fakeCall = makeFakeCall();
    mockCallRef.current = fakeCall;
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    await act(async () => { await result.current.toggleMute(); });
    expect(fakeCall.setLocalAudio).toHaveBeenCalledWith(false);
    expect(result.current.isMuted).toBe(true);
  });

  it('alterna de volta na segunda chamada', async () => {
    const fakeCall = makeFakeCall();
    mockCallRef.current = fakeCall;
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    await act(async () => { await result.current.toggleMute(); });
    await act(async () => { await result.current.toggleMute(); });
    expect(fakeCall.setLocalAudio).toHaveBeenLastCalledWith(true);
    expect(result.current.isMuted).toBe(false);
  });

  it('não faz nada com callRef=null', async () => {
    mockCallRef.current = null;
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    await act(async () => { await result.current.toggleMute(); });
    expect(result.current.isMuted).toBe(false);
  });
});

describe('useDailyCall — toggleCamera', () => {
  it('chama setLocalVideo(false) e atualiza isCameraOff=true', async () => {
    const fakeCall = makeFakeCall();
    mockCallRef.current = fakeCall;
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    await act(async () => { await result.current.toggleCamera(); });
    expect(fakeCall.setLocalVideo).toHaveBeenCalledWith(false);
    expect(result.current.isCameraOff).toBe(true);
  });

  it('alterna câmera de volta', async () => {
    const fakeCall = makeFakeCall();
    mockCallRef.current = fakeCall;
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    await act(async () => { await result.current.toggleCamera(); });
    await act(async () => { await result.current.toggleCamera(); });
    expect(result.current.isCameraOff).toBe(false);
  });
});

describe('useDailyCall — flipCamera', () => {
  it('chama cycleCamera e inverte isFrontCamera', async () => {
    const fakeCall = makeFakeCall();
    mockCallRef.current = fakeCall;
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    await act(async () => { await result.current.flipCamera(); });
    expect(fakeCall.cycleCamera).toHaveBeenCalled();
    expect(result.current.isFrontCamera).toBe(false);
  });

  it('NÃO inverte quando cycleCamera falha (FIX #16)', async () => {
    const fakeCall = makeFakeCall();
    fakeCall.cycleCamera.mockRejectedValueOnce(new Error('not supported'));
    mockCallRef.current = fakeCall;
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    await act(async () => { await result.current.flipCamera(); });
    expect(result.current.isFrontCamera).toBe(true);
  });
});

describe('useDailyCall — join/leave/callbacks', () => {
  it('delega join() para useDailyJoin', async () => {
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    await act(async () => { await result.current.join(); });
    expect(mockJoin).toHaveBeenCalled();
  });

  it('delega leave() para useDailyJoin', async () => {
    const { result } = renderHook(() => useDailyCall(defaultOptions));
    await act(async () => { await result.current.leave(); });
    expect(mockLeave).toHaveBeenCalled();
  });

  it('aceita callbacks opcionais sem crash', () => {
    const { result } = renderHook(() =>
      useDailyCall({
        ...defaultOptions,
        isDoctor: true,
        onRemoteJoined: jest.fn(),
        onCallEnded: jest.fn(),
        onError: jest.fn(),
      })
    );
    expect(result.current).toBeDefined();
  });
});
