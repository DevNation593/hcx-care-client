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

/** How many validation issues the message names before it only counts the rest. */
const VALIDATION_SUMMARY_LIMIT = 3;

/** Spanish names of the fields forms send most; any other field is named generically. */
const FIELD_LABELS: Record<string, string> = {
  email: 'Correo electrónico',
  password: 'Contraseña',
  name: 'Nombre',
  firstName: 'Nombre',
  lastName: 'Apellido',
  phone: 'Teléfono',
  address: 'Dirección',
  documentNumber: 'Número de documento',
  birthDate: 'Fecha de nacimiento',
  startTime: 'Hora de inicio',
  endTime: 'Hora de fin',
  notes: 'Notas',
  quantity: 'Cantidad',
  price: 'Precio',
  amount: 'Monto',
};

/**
 * class-validator's default texts after "<property> ", and what each asks for in Spanish. Only the
 * digits a template captures reach the message: nothing else of the API's text is shown.
 */
const VALIDATION_RULES: ReadonlyArray<[RegExp, (n: string) => string]> = [
  [/^(?:should not be empty|should not be null or undefined)$/, () => 'es obligatorio'],
  [/^must be a string$/, () => 'debe ser texto'],
  [/^must be shorter than or equal to (\d+) characters$/, (n) => `debe tener como máximo ${n} caracteres`],
  [/^must be longer than or equal to (\d+) characters$/, (n) => `debe tener al menos ${n} caracteres`],
  [/^must not be less than (-?\d+(?:\.\d+)?)$/, (n) => `debe ser mayor o igual a ${n}`],
  [/^must not be greater than (-?\d+(?:\.\d+)?)$/, (n) => `debe ser menor o igual a ${n}`],
  [/^must be an integer number$/, () => 'debe ser un número entero'],
  [/^(?:must be a number conforming to the specified constraints|must be a number string)$/, () => 'debe ser un número'],
  [/^must be a positive number$/, () => 'debe ser mayor que 0'],
  [/^must be a boolean value$/, () => 'debe ser verdadero o falso'],
  [/^must be one of the following values: .*$/, () => 'tiene un valor no permitido'],
  [/^must be an array$/, () => 'debe ser una lista'],
  [/^must contain at least (\d+) elements$/, (n) => `debe tener al menos ${n} elemento${n === '1' ? '' : 's'}`],
  [/^must contain no more than (\d+) elements$/, (n) => `debe tener como máximo ${n} elemento${n === '1' ? '' : 's'}`],
  [/^must be an email$/, () => 'debe ser un correo electrónico válido'],
  [/^must be a valid ISO 8601 date string$/, () => 'debe ser una fecha válida'],
  [/^must be a URL address$/, () => 'debe ser una URL válida'],
  [/^must be a UUID$/, () => 'debe ser un identificador válido'],
];

const ISSUE = /^(each value in )?([A-Za-z_$][\w$]*) (.+)$/;
const NOT_ALLOWED = /^property [\w$.[\]]+ should not exist$/;

/** A controlled Spanish text for a class-validator default message, or undefined if unknown. */
function translateIssue(text: string): string | undefined {
  if (NOT_ALLOWED.test(text)) return 'La solicitud incluye un campo no permitido.';
  const issue = ISSUE.exec(text);
  if (!issue) return undefined;
  const [, each, property, rest] = issue;
  for (const [template, describe] of VALIDATION_RULES) {
    const match = template.exec(rest);
    if (!match) continue;
    const label = Object.hasOwn(FIELD_LABELS, property) ? FIELD_LABELS[property] : undefined;
    const subject = label
      ? `${each ? 'Cada valor del campo' : 'El campo'} «${label}»`
      : each ? 'Cada valor de un campo' : 'Un campo';
    return `${subject} ${describe(match[1] ?? '')}.`;
  }
  return undefined;
}

/**
 * A validation list (a pipe without the API's Spanish exceptionFactory): the issues it recognizes,
 * in controlled Spanish, and the reason of the status for the rest. Its own texts are never shown.
 */
function validationMessage(issues: unknown[], status?: number): string {
  const texts = issues.filter((m): m is string => typeof m === 'string' && !!m.trim());
  const known = [...new Set(texts.map((text) => translateIssue(text.trim())))];
  const translated = known.filter((text): text is string => text !== undefined);
  const shown = translated.slice(0, VALIDATION_SUMMARY_LIMIT);
  const rest = translated.length - shown.length;
  if (rest > 0) shown.push(`Y ${rest} problema${rest === 1 ? '' : 's'} más.`);
  if (known.includes(undefined) || shown.length === 0) shown.push(statusMessage(status));
  return shown.join(' ');
}

/** The message of an API error body: its own text, or the reason of its status. */
export function messageFromBody(message: unknown, status?: number): string {
  if (Array.isArray(message)) return validationMessage(message, status);
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
