/**
 * @jest-environment jsdom
 */
const mockAddEventListener = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: mockAddEventListener,
  __esModule: true,
  default: {
    addEventListener: mockAddEventListener,
  },
}));

import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    mockAddEventListener.mockReset();
    mockAddEventListener.mockReturnValue(jest.fn());
  });

  it('starts with isConnected = true', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isConnected).toBe(true);
  });

  it('subscribes to NetInfo on mount', () => {
    renderHook(() => useNetworkStatus());
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(mockAddEventListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('updates isConnected when network goes offline', () => {
    let callback: (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
    mockAddEventListener.mockImplementation((cb: any) => {
      callback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      callback({ isConnected: false, isInternetReachable: false });
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('updates isConnected when network comes back online', () => {
    let callback: (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
    mockAddEventListener.mockImplementation((cb: any) => {
      callback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      callback({ isConnected: false, isInternetReachable: false });
    });
    expect(result.current.isConnected).toBe(false);

    act(() => {
      callback({ isConnected: true, isInternetReachable: true });
    });
    expect(result.current.isConnected).toBe(true);
  });

  it('treats connected but unreachable as offline (captive portal)', () => {
    let callback: (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
    mockAddEventListener.mockImplementation((cb: any) => {
      callback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      callback({ isConnected: true, isInternetReachable: false });
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('treats null isConnected as offline', () => {
    let callback: (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
    mockAddEventListener.mockImplementation((cb: any) => {
      callback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      callback({ isConnected: null, isInternetReachable: null });
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('only subscribes once even on re-renders', () => {
    const { rerender } = renderHook(() => useNetworkStatus());
    rerender();
    rerender();
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
  });
});
