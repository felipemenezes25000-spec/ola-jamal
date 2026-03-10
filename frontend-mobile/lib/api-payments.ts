import { apiClient } from './api-client';
import type { PaymentResponseDto } from '../types/database';

// ============================================
// PAYMENT MANAGEMENT
// ============================================

export interface CreatePaymentData {
  requestId: string;
  paymentMethod?: string;
  token?: string;
  installments?: number;
  paymentMethodId?: string;
  issuerId?: number;
  payerEmail?: string;
  payerCpf?: string;
  saveCard?: boolean;
}

export async function createPayment(data: CreatePaymentData): Promise<PaymentResponseDto> {
  return apiClient.post('/api/payments', data);
}

/** Retorna o pagamento pendente ou null se não existir (resposta 200 com body null). */
export async function fetchPaymentByRequest(requestId: string): Promise<PaymentResponseDto | null> {
  const result = await apiClient.get<PaymentResponseDto | null>(`/api/payments/by-request/${requestId}`);
  return result ?? null;
}

export async function fetchPayment(paymentId: string): Promise<PaymentResponseDto> {
  return apiClient.get(`/api/payments/${paymentId}`);
}

export async function fetchPixCode(paymentId: string): Promise<string> {
  return apiClient.get(`/api/payments/${paymentId}/pix-code`);
}

export async function confirmPayment(paymentId: string): Promise<PaymentResponseDto> {
  return apiClient.post(`/api/payments/${paymentId}/confirm`, {});
}

export async function confirmPaymentByRequest(requestId: string): Promise<PaymentResponseDto> {
  return apiClient.post(`/api/payments/confirm-by-request/${requestId}`, {});
}

/** Sincroniza status do pagamento com Mercado Pago (útil quando webhook falha). */
export async function syncPaymentStatus(requestId: string): Promise<PaymentResponseDto> {
  return apiClient.post(`/api/payments/sync-status/${requestId}`, {});
}

/** Retorna URL do Checkout Pro e ID do pagamento para abrir no navegador e exibir na tela */
export async function getCheckoutProUrl(requestId: string): Promise<{ initPoint: string; paymentId: string }> {
  return apiClient.get(`/api/payments/checkout-pro/${requestId}`);
}

export interface SavedCardDto {
  id: string;
  mpCardId: string;
  lastFour: string;
  brand: string;
}

/** Lista cartões salvos do usuário */
export async function fetchSavedCards(): Promise<SavedCardDto[]> {
  return apiClient.get<SavedCardDto[]>('/api/payments/saved-cards');
}

/** Pagar com cartão salvo (token criado via mp.fields.createCardToken no frontend) */
export async function payWithSavedCard(
  requestId: string,
  savedCardId: string,
  token: string
): Promise<PaymentResponseDto> {
  return apiClient.post('/api/payments/saved-card', {
    requestId,
    savedCardId,
    token,
  });
}
