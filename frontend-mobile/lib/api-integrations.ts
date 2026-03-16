import { apiClient } from './api-client';

// ============================================
// INTEGRATIONS
// ============================================

export async function getIntegrationStatus(): Promise<Record<string, unknown>> {
  return apiClient.get('/api/integrations/status');
}
