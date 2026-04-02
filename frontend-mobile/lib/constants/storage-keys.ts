/**
 * Chaves centralizadas para AsyncStorage/localStorage.
 * Evita duplicação e inconsistência entre AuthContext e api-client.
 */
export const AUTH_TOKEN_KEY = '@renoveja:auth_token';
export const REFRESH_TOKEN_KEY = '@renoveja:refresh_token';
