/** Seconds before its `exp` at which an access token already counts as expired. */
const EXPIRY_SKEW_SECONDS = 30;

/** The `exp` claim (seconds since the epoch) of a JWT, or null when it cannot be read. */
export function accessTokenExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const exp: unknown = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/**
 * Whether the access token is expired or about to be. The token is only read to decide when to
 * refresh: the API still validates it on every request.
 */
export function isAccessTokenExpired(token: string, nowMs: number = Date.now()): boolean {
  const exp = accessTokenExpiry(token);
  return exp === null || exp * 1000 - EXPIRY_SKEW_SECONDS * 1000 <= nowMs;
}
