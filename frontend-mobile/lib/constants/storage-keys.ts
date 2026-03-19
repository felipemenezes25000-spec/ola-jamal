/**
 * Chaves centralizadas para AsyncStorage/localStorage.
 * Evita duplicação e inconsistência entre AuthContext, api-client e fluxos de pagamento.
 */
export const AUTH_TOKEN_KEY = '@renoveja:auth_token';
export const REFRESH_TOKEN_KEY = '@renoveja:refresh_token';
