/**
 * Registry do token de push atual.
 * Permite que AuthContext chame unregister antes de clearAuth (evita 401).
 */
let lastRegisteredPushToken: string | null = null;

export function setLastRegisteredPushToken(token: string | null): void {
  lastRegisteredPushToken = token;
}

export function getLastRegisteredPushToken(): string | null {
  return lastRegisteredPushToken;
}
