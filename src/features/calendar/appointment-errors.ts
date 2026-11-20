const GENERIC_ERROR = 'No se pudo completar la operación. Inténtalo nuevamente.';

/**
 * The API owns the wording of business-rule rejections (4xx), so it is shown as sent.
 * Server failures (5xx) and errors without a usable message get generic copy instead.
 */
export function getAppointmentErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || Array.isArray(error)) return GENERIC_ERROR;
  const { message, status } = error as { message?: unknown; status?: unknown };
  if (typeof status === 'number' && status >= 500) return GENERIC_ERROR;
  return typeof message === 'string' && message.trim() ? message : GENERIC_ERROR;
}
