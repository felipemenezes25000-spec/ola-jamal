/**
 * SHA-256 hash in hex using Web Crypto (browser).
 * Used only for verification flow; code is hashed before sending in production alternatives.
 * This client hashes for optional client-side checks; the real verification is server-side.
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
