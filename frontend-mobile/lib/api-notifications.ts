import { apiClient } from './api-client';
import type { NotificationResponseDto, PagedResponse, PushTokenDto } from '../types/database';

// ============================================
// NOTIFICATIONS
// ============================================

export async function fetchNotifications(
  page: number = 1,
  pageSize: number = 20,
): Promise<PagedResponse<NotificationResponseDto>> {
  return apiClient.get('/api/notifications', { page, pageSize });
}

export async function markNotificationRead(notificationId: string): Promise<NotificationResponseDto> {
  return apiClient.put(`/api/notifications/${notificationId}/read`, {});
}

export async function markAllNotificationsRead(): Promise<void> {
  return apiClient.put('/api/notifications/read-all', {});
}

export async function getUnreadNotificationsCount(): Promise<number> {
  const res = await apiClient.get<{ count: number }>('/api/notifications/unread-count');
  return res?.count ?? 0;
}

// ============================================
// PUSH TOKENS
// ============================================

export async function registerPushToken(token: string, deviceType: string): Promise<void> {
  return apiClient.post('/api/push-tokens', { token, deviceType });
}

export async function unregisterPushToken(token: string): Promise<void> {
  return apiClient.delete(`/api/push-tokens?token=${encodeURIComponent(token)}`);
}

export async function fetchPushTokens(): Promise<PushTokenDto[]> {
  return apiClient.get('/api/push-tokens');
}

export async function setPushPreference(pushEnabled: boolean): Promise<void> {
  return apiClient.put('/api/push-tokens/preference', { pushEnabled });
}

export async function sendTestPush(): Promise<{ message: string }> {
  return apiClient.post('/api/push-tokens/test');
}
