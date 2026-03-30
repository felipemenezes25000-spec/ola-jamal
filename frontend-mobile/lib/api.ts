/**
 * api.ts — Facade / barrel file.
 *
 * All API functions are defined in domain-specific modules:
 *   api-requests.ts      — Request CRUD, approval, signing, PDF, content
 *   api-doctors.ts       — Doctor profiles, specialties, certificates, stats
 *   api-clinical.ts      — FHIR-Lite prontuário, patient data, doctor notes
 *   api-consultation.ts  — Transcription, conduct management
 *   api-auth-extended.ts — Password change, avatar upload
 *   api-notifications.ts — Push tokens, notification CRUD
 *   api-video.ts         — Video rooms (Daily.co)
 *   api-integrations.ts  — Integration status
 *
 * This file re-exports everything so existing imports continue to work:
 *   import { fetchRequests } from '../lib/api-requests';
 */

import { fetchRequests, fetchRequestById } from './api-requests';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from './api-notifications';
import { fetchDoctorQueue } from './api-doctors';

// Re-export UserDto for consumers that imported it from api.ts
export type { UserDto } from '../types/database';

// ── Domain modules ──────────────────────────────────────────────
export * from './api-requests';
export * from './api-doctors';
export * from './api-clinical';
export * from './api-consultation';
export * from './api-auth-extended';

// ── Existing split modules ──────────────────────────────────────
export {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationsCount,
  registerPushToken,
  unregisterPushToken,
  fetchPushTokens,
  setPushPreference,
  sendTestPush,
} from './api-notifications';

export { createVideoRoom, fetchVideoRoom, fetchVideoRoomByRequest } from './api-video';

export { getIntegrationStatus } from './api-integrations';

// ── Aliases (backward compat for screens) ───────────────────────
export function getRequests(
  params?: { page?: number; pageSize?: number; status?: string; type?: string },
  options?: { signal?: AbortSignal }
) {
  return fetchRequests(params, options);
}
export const getRequestById = fetchRequestById;
export const getNotifications = (params?: { page?: number; pageSize?: number }) =>
  fetchNotifications(params?.page, params?.pageSize);
export const markNotificationAsRead = markNotificationRead;
export const markAllNotificationsAsRead = markAllNotificationsRead;
export const getDoctorQueue = (specialty?: string) =>
  fetchDoctorQueue(specialty);
