/**
 * Testes do NotificationContext — markAllReadOptimistic e rollback.
 */

const mockMarkAllNotificationsAsRead = jest.fn();
const mockGetUnreadNotificationsCount = jest.fn();

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../contexts/PushNotificationContext', () => ({
  usePushNotification: () => ({ lastNotificationAt: 0 }),
}));

jest.mock('../lib/api', () => ({
  getUnreadNotificationsCount: (...args: unknown[]) => mockGetUnreadNotificationsCount(...args),
  markAllNotificationsAsRead: (...args: unknown[]) => mockMarkAllNotificationsAsRead(...args),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { NotificationProvider, useNotifications } from '../contexts/NotificationContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

describe('NotificationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnreadNotificationsCount.mockResolvedValue(5);
  });

  it('decrementUnreadCount reduces count optimistically', async () => {
    mockGetUnreadNotificationsCount.mockResolvedValueOnce(10).mockResolvedValue(10);

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.unreadCount).toBe(10));

    await act(async () => {
      result.current.decrementUnreadCount();
    });

    expect(result.current.unreadCount).toBe(9);

    await act(async () => {
      result.current.decrementUnreadCount();
      result.current.decrementUnreadCount();
    });

    expect(result.current.unreadCount).toBe(7);
  });

  it('decrementUnreadCount does not go below 0', async () => {
    mockGetUnreadNotificationsCount.mockResolvedValueOnce(1).mockResolvedValue(1);

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    await act(async () => {
      result.current.decrementUnreadCount();
      result.current.decrementUnreadCount();
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('markAllReadOptimistic sets unreadCount to 0 immediately', async () => {
    mockMarkAllNotificationsAsRead.mockImplementation(() => new Promise((r) => setTimeout(r, 100)));

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.unreadCount).toBe(5));

    await act(async () => {
      await result.current.markAllReadOptimistic();
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('markAllReadOptimistic rolls back on API error', async () => {
    mockMarkAllNotificationsAsRead.mockRejectedValue(new Error('Network error'));
    mockGetUnreadNotificationsCount.mockResolvedValue(3);

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.unreadCount).toBe(3));

    await expect(
      act(async () => {
        await result.current.markAllReadOptimistic();
      })
    ).rejects.toThrow('Network error');

    await waitFor(() => expect(mockGetUnreadNotificationsCount).toHaveBeenCalled());

    expect(result.current.unreadCount).toBe(3);
  });
});
