import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';

const interceptor = vi.hoisted(() => ({
  onRejected: (error: unknown): Promise<never> => Promise.reject(error),
  status: 409,
  url: '/onboarding/tenants',
  responseData: {
    statusCode: 409, message: 'El correo electrónico ya está en uso',
    code: 'EMAIL_CONFLICT', field: 'adminEmail', details: { existing: true },
  } as unknown,
}));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: (_success: unknown, rejected: typeof interceptor.onRejected) => { interceptor.onRejected = rejected; } },
      },
      post: () => interceptor.onRejected({
        config: { url: interceptor.url },
        response: { status: interceptor.status, data: interceptor.responseData },
      }),
    }),
  },
}));

describe('ApiClient error normalization', () => {
  beforeEach(() => {
    interceptor.status = 409;
    interceptor.url = '/onboarding/tenants';
    interceptor.responseData = {
      statusCode: 409, message: 'El correo electrónico ya está en uso',
      code: 'EMAIL_CONFLICT', field: 'adminEmail', details: { existing: true },
    };
  });

  it('preserves HTTP status without leaking the raw Axios response', async () => {
    try {
      await apiClient.post('/onboarding/tenants', {});
      throw new Error('Expected 409');
    } catch (error) {
      expect(error).toMatchObject({
        status: 409, message: 'El correo electrónico ya está en uso', code: 'EMAIL_CONFLICT',
        field: 'adminEmail', details: { existing: true },
      });
      expect(error).not.toHaveProperty('response');
      expect(error).not.toHaveProperty('config');
      expect(error).not.toHaveProperty('request');
    }
  });

  it('keeps HTTP status even when the server returns no body', async () => {
    interceptor.responseData = null;
    await expect(apiClient.post('/onboarding/tenants', {})).rejects.toMatchObject({
      status: 409, message: 'Ocurrió un error',
    });
  });

  it.each([
    ['string body', 'raw server text'],
    ['array body', [{ message: 'fake' }]],
    ['hostile object', { message: { secret: 'password' }, code: 409, field: ['adminEmail'], details: ['not a record'] }],
    ['null fields', { message: null, code: null, field: null, details: 'not a record' }],
  ])('normalizes %s without false field types or raw transport data', async (_name, body) => {
    interceptor.responseData = body;
    try {
      await apiClient.post('/onboarding/tenants', {});
      throw new Error('Expected 409');
    } catch (error) {
      expect(error).toMatchObject({ status: 409, message: 'Ocurrió un error' });
      expect(error).not.toHaveProperty('code');
      expect(error).not.toHaveProperty('field');
      expect(error).not.toHaveProperty('details');
      expect(error).not.toHaveProperty('response');
      expect(error).not.toHaveProperty('config');
      expect(error).not.toHaveProperty('request');
    }
  });

  it('reads the JSON error body of a request that expected a file', async () => {
    interceptor.status = 500;
    interceptor.responseData = new Blob(
      [JSON.stringify({
        statusCode: 500, code: 'CONSENT_PDF_INTEGRITY',
        message: 'El PDF del consentimiento no coincide con el que se firmó.',
      })],
      { type: 'application/json' },
    );
    await expect(apiClient.post('/tenants/t/consent-documents/d/pdf', {})).rejects.toMatchObject({
      status: 500, code: 'CONSENT_PDF_INTEGRITY',
      message: 'El PDF del consentimiento no coincide con el que se firmó.',
    });
  });

  it('keeps the generic message when a file error body is not JSON', async () => {
    interceptor.status = 500;
    interceptor.responseData = new Blob(['<html>Bad gateway</html>'], { type: 'text/html' });
    await expect(apiClient.post('/tenants/t/consent-documents/d/pdf', {})).rejects.toMatchObject({
      status: 500, message: 'Ocurrió un error',
    });
  });

  it('keeps the missing requirements of a blocked start', async () => {
    interceptor.status = 422;
    interceptor.responseData = {
      statusCode: 422, code: 'TREATMENT_REQUIREMENTS_MISSING', message: 'Faltan requisitos',
      missing: ['FINALIZED_MEDICAL_FORM', 'BEFORE_PHOTOS'],
    };
    await expect(apiClient.post('/treatment-sessions/s1/start', {})).rejects.toMatchObject({
      status: 422, code: 'TREATMENT_REQUIREMENTS_MISSING', missing: ['FINALIZED_MEDICAL_FORM', 'BEFORE_PHOTOS'],
    });
  });

  it.each([
    ['a string', 'BEFORE_PHOTOS'],
    ['an object', { 0: 'BEFORE_PHOTOS' }],
  ])('drops `missing` when it is %s instead of a list', async (_name, missing) => {
    interceptor.responseData = { statusCode: 422, message: 'Faltan requisitos', missing };
    const error = await apiClient.post('/treatment-sessions/s1/start', {}).catch((e) => e);
    expect(error).not.toHaveProperty('missing');
  });

  it('keeps only known requirement codes in `missing`', async () => {
    interceptor.responseData = {
      statusCode: 422, message: 'Faltan requisitos', missing: ['AFTER_PHOTOS', 'constructor', 'SOMETHING_NEW', 7, null],
    };
    await expect(apiClient.post('/treatment-sessions/s1/complete', {})).rejects.toMatchObject({ missing: ['AFTER_PHOTOS'] });
  });

  it('maps the plain-text issues of rejected treatment requirements to issue entries', async () => {
    interceptor.status = 400;
    interceptor.responseData = {
      statusCode: 400, code: 'TREATMENT_REQUIREMENTS_INVALID', message: 'Los requisitos del tratamiento no son válidos.',
      issues: ['photos.minimumBefore debe ser un entero entre 0 y 20', 7, 'consentTemplateVersionId no existe'],
    };
    await expect(apiClient.post('/treatments', {})).rejects.toMatchObject({
      status: 400, code: 'TREATMENT_REQUIREMENTS_INVALID',
      issues: [
        { field: '', message: 'photos.minimumBefore debe ser un entero entre 0 y 20' },
        { field: '', message: 'consentTemplateVersionId no existe' },
      ],
    });
  });

  it('ignores `issues` that is not a list', async () => {
    interceptor.responseData = { statusCode: 400, message: 'Invalid', issues: 'nope' };
    const error = await apiClient.post('/treatments', {}).catch((e) => e);
    expect(error).not.toHaveProperty('issues');
  });

  it('uses the uppercase guard code reported in `error` as the error code', async () => {
    interceptor.responseData = {
      statusCode: 403, error: 'FEATURE_NOT_AVAILABLE', message: 'This feature requires a higher plan.',
    };
    await expect(apiClient.post('/tasks', {})).rejects.toMatchObject({ code: 'FEATURE_NOT_AVAILABLE' });
  });

  it('ignores the default HTTP reason phrase in `error`', async () => {
    interceptor.responseData = { statusCode: 403, error: 'Forbidden', message: 'Forbidden resource' };
    const error = await apiClient.post('/tasks', {}).catch((e) => e);
    expect(error).not.toHaveProperty('code');
  });
});

describe('ApiClient temporary password redirect', () => {
  const originalLocation = window.location;
  const passwordRequired = {
    statusCode: 403, code: 'PASSWORD_CHANGE_REQUIRED', message: 'Debes cambiar tu contraseña',
  };
  const setLocation = (pathname: string) =>
    Object.defineProperty(window, 'location', { configurable: true, value: { pathname, href: pathname } });

  beforeEach(() => {
    interceptor.status = 403;
    interceptor.url = '/tenants/t1/patients';
    interceptor.responseData = passwordRequired;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('redirects to /change-password on a 403 PASSWORD_CHANGE_REQUIRED and still rejects', async () => {
    setLocation('/dashboard');
    await expect(apiClient.post('/tenants/t1/patients', {})).rejects.toMatchObject({
      status: 403, code: 'PASSWORD_CHANGE_REQUIRED',
    });
    expect(window.location.href).toBe('/change-password');
  });

  it('does not redirect when already on /change-password', async () => {
    setLocation('/change-password');
    await expect(apiClient.post('/tenants/t1/patients', {})).rejects.toMatchObject({
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
    expect(window.location.href).toBe('/change-password');
    expect(window.location.pathname).toBe('/change-password');
  });

  it('does not refresh the token or log out when the current password is wrong', async () => {
    setLocation('/change-password');
    interceptor.status = 401;
    interceptor.url = '/auth/change-password';
    interceptor.responseData = { statusCode: 401, message: 'La contraseña actual es incorrecta' };
    await expect(apiClient.post('/auth/change-password', {})).rejects.toMatchObject({
      status: 401, message: 'La contraseña actual es incorrecta',
    });
    expect(window.location.href).toBe('/change-password');
  });
});
