/**
 * The API client rejects with plain ApiError objects (not AxiosError), so Sentry cannot tell
 * them apart from other thrown values. The marker is a non-enumerable symbol property: it does
 * not show up in Object.keys, spreads, JSON or equality checks.
 */
const API_ERROR_MARKER = Symbol.for('hcx.apiError');

export function markApiError<T extends object>(error: T): T {
  if (!Object.prototype.hasOwnProperty.call(error, API_ERROR_MARKER)) {
    Object.defineProperty(error, API_ERROR_MARKER, { value: true, enumerable: false });
  }
  return error;
}

export function isMarkedApiError(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[API_ERROR_MARKER] === true
  );
}
