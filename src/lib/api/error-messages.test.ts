import { describe, expect, it } from 'vitest';
import {
  getErrorMessage,
  messageFromBody,
  statusMessage,
  UNKNOWN_ERROR_MESSAGE,
} from './error-messages';

describe('messageFromBody', () => {
  it('keeps the reason the API explains', () => {
    expect(messageFromBody('El horario ya está ocupado', 409)).toBe('El horario ya está ocupado');
  });

  it('joins the issues of a validation list', () => {
    expect(messageFromBody(['email must be an email', 'name should not be empty'], 400)).toBe(
      'email must be an email. name should not be empty',
    );
  });

  it.each([
    ['Forbidden resource', 403],
    ['Unauthorized', 401],
    ['Internal server error', 500],
    ['ThrottlerException: Too Many Requests', 429],
    ['Cannot GET /api/v1/nada', 404],
    ['File too large', 413],
  ])('replaces the default English text %p by the reason of its status', (message, status) => {
    expect(messageFromBody(message, status)).toBe(statusMessage(status));
  });

  it.each([[undefined], [''], [{ secret: 'x' }], [null]])(
    'falls back to the reason of the status for %p',
    (message) => {
      expect(messageFromBody(message, 404)).toBe(statusMessage(404));
    },
  );
});

describe('statusMessage', () => {
  it('has a specific reason per status', () => {
    expect(statusMessage(403)).toMatch(/permiso/);
    expect(statusMessage(413)).toMatch(/tamaño máximo/);
    expect(statusMessage(429)).toMatch(/Demasiadas solicitudes/);
  });

  it('groups unknown statuses as client or server errors', () => {
    expect(statusMessage(418)).toBe(statusMessage(400));
    expect(statusMessage(599)).toBe(statusMessage(500));
    expect(statusMessage(undefined)).toBe(UNKNOWN_ERROR_MESSAGE);
  });
});

describe('getErrorMessage', () => {
  it('reads the message of an API error or an Error', () => {
    expect(getErrorMessage({ message: 'Paciente no encontrado', status: 404 })).toBe(
      'Paciente no encontrado',
    );
    expect(getErrorMessage(new Error('Falló'))).toBe('Falló');
  });

  it('uses the fallback when there is no message', () => {
    expect(getErrorMessage(null, 'Intenta nuevamente.')).toBe('Intenta nuevamente.');
    expect(getErrorMessage({ message: '' })).toBe(UNKNOWN_ERROR_MESSAGE);
  });
});
