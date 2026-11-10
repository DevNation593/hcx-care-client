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

  describe('a validation list', () => {
    it('shows the issues it recognizes in controlled Spanish, never the raw texts', () => {
      const message = messageFromBody(['email must be an email', 'name should not be empty'], 400);
      expect(message).toBe(
        'El campo «Correo electrónico» debe ser un correo electrónico válido. El campo «Nombre» es obligatorio.',
      );
      expect(message).not.toMatch(/must be|should not/);
    });

    it('names an unknown field generically and keeps only the limit a rule captures', () => {
      expect(
        messageFromBody(
          [
            'internalCode must be longer than or equal to 8 characters',
            'each value in tags must be a string',
            'role must be one of the following values: <b>ADMIN</b>, MASTER',
          ],
          400,
        ),
      ).toBe(
        'Un campo debe tener al menos 8 caracteres. Cada valor de un campo debe ser texto. Un campo tiene un valor no permitido.',
      );
    });

    it('says a field is not allowed without naming it', () => {
      expect(messageFromBody(['property isAdmin should not exist'], 400)).toBe(
        'La solicitud incluye un campo no permitido.',
      );
    });

    it('uses the reason of the status for issues it does not recognize', () => {
      const raw = ['<img src=x onerror=alert(1)>', 'email debe ser válido según el proveedor'];
      expect(messageFromBody(raw, 400)).toBe(statusMessage(400));
      expect(messageFromBody(['email must be an email', ...raw], 422)).toBe(
        `El campo «Correo electrónico» debe ser un correo electrónico válido. ${statusMessage(422)}`,
      );
    });

    it('drops repeated issues and counts what it does not list', () => {
      expect(
        messageFromBody(
          [
            'email must be an email',
            'email must be an email',
            'name should not be empty',
            'phone must be a string',
            'quantity must not be less than 1',
            'price must be a positive number',
          ],
          400,
        ),
      ).toBe(
        'El campo «Correo electrónico» debe ser un correo electrónico válido. El campo «Nombre» es obligatorio. El campo «Teléfono» debe ser texto. Y 2 problemas más.',
      );
    });

    it.each([[[]], [['', '  ', 42, null]]])('falls back to the reason of the status for %p', (list) => {
      expect(messageFromBody(list, 400)).toBe(statusMessage(400));
    });
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
