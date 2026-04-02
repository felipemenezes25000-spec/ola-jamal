import { apiClient } from './api-client';

// ============================================
// PUSH PREFERENCES (por categoria)
// ============================================

export interface PushPreferencesDto {
  requestsEnabled: boolean;
  consultationsEnabled: boolean;
  remindersEnabled: boolean;
  timezone: string;
}

export async function getPushPreferences(): Promise<PushPreferencesDto> {
  return apiClient.get('/api/push-tokens/preferences');
}

export async function updatePushPreferences(
  prefs: Partial<PushPreferencesDto>
): Promise<PushPreferencesDto> {
  return apiClient.put('/api/push-tokens/preferences', prefs);
}
