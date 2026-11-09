/**
 * Spanish reasons for API errors whose body does not explain itself, and the helper the UI uses
 * to show the reason of any error.
 */

const STATUS_MESSAGES: Record<number, string> = {
  400: 'La solicitud tiene datos inválidos. Revisa la información e intenta de nuevo.',
  401: 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'El recurso solicitado no existe o fue eliminado.',
  405: 'La operación no está permitida.',
  408: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
  409: 'La operación entra en conflicto con datos existentes. Actualiza la página e intenta de nuevo.',
  413: 'El archivo o la solicitud supera el tamaño máximo permitido.',
  415: 'El tipo de archivo no es compatible.',
  422: 'Los datos enviados no se pueden procesar.',
  429: 'Demasiadas solicitudes seguidas. Espera un momento e intenta de nuevo.',
  500: 'Ocurrió un error inesperado en el servidor. Intenta de nuevo; si el problema continúa, contacta a soporte.',
  502: 'Un servicio externo no respondió correctamente. Intenta de nuevo en unos minutos.',
  503: 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.',
  504: 'El servidor tardó demasiado en responder. Intenta de nuevo en unos minutos.',
};

export const NETWORK_ERROR_MESSAGE =
  'No se recibió respuesta del servidor. Verifica tu conexión a internet.';
export const TIMEOUT_ERROR_MESSAGE =
  'El servidor tardó demasiado en responder. Revisa tu conexión e intenta de nuevo.';
export const UNKNOWN_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intenta de nuevo.';

/** Default English texts of NestJS and its pipes: they say nothing useful to the user. */
const ENGLISH_DEFAULTS = /^(forbidden resource|unauthorized|not found|bad request|internal server error|conflict|payload too large|too many requests|throttlerexception.*|cannot (get|post|put|patch|delete) \/.*|file too large|validation failed \(.*\))$/i;

export function statusMessage(status?: number): string {
  if (status === undefined) return UNKNOWN_ERROR_MESSAGE;
  return STATUS_MESSAGES[status] ?? (status >= 500 ? STATUS_MESSAGES[500] : STATUS_MESSAGES[400]);
}

/** The message of an API error body: its own text, or the reason of its status. */
export function messageFromBody(message: unknown, status?: number): string {
  if (Array.isArray(message)) {
    const texts = message.filter((m): m is string => typeof m === 'string' && !!m.trim());
    if (texts.length) return texts.join('. ');
  }
  if (typeof message === 'string' && message.trim() && !ENGLISH_DEFAULTS.test(message.trim())) {
    return message;
  }
  return statusMessage(status);
}

/** The reason of any error thrown by the API client (or anything else), for a toast or alert. */
export function getErrorMessage(error: unknown, fallback = UNKNOWN_ERROR_MESSAGE): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
