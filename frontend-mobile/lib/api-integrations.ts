import { apiClient } from './api-client';

// ============================================
// INTEGRATIONS
// ============================================

export async function getMercadoPagoPublicKey(): Promise<{ publicKey: string }> {
  return apiClient.get('/api/integrations/mercadopago-public-key');
}

export async function getIntegrationStatus(): Promise<Record<string, unknown>> {
  return apiClient.get('/api/integrations/status');
}
