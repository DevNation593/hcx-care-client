import { describe, expect, it } from 'vitest';
import { isMarkedApiError, markApiError } from './api-error-marker';

describe('markApiError', () => {
  it('returns the same object and marks it', () => {
    const error = { code: 'TIMEOUT', message: 'Tiempo agotado' };

    const marked = markApiError(error);

    expect(marked).toBe(error);
    expect(isMarkedApiError(marked)).toBe(true);
  });

  it('does not change the enumerable shape of the object', () => {
    const error = { code: 'EMAIL_CONFLICT', message: 'En uso', status: 409 };

    markApiError(error);

    expect(Object.keys(error)).toEqual(['code', 'message', 'status']);
    expect(error).toEqual({ code: 'EMAIL_CONFLICT', message: 'En uso', status: 409 });
    expect(JSON.parse(JSON.stringify(error))).toEqual({ code: 'EMAIL_CONFLICT', message: 'En uso', status: 409 });
  });

  it('can be marked twice', () => {
    const error = markApiError({ message: 'x' });

    expect(() => markApiError(error)).not.toThrow();
    expect(isMarkedApiError(error)).toBe(true);
  });
});

describe('isMarkedApiError', () => {
  it.each([
    ['a plain object', { code: 'X', message: 'y' }],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'boom'],
    ['a number', 42],
    ['an Error', new Error('boom')],
  ])('is false for %s', (_name, value) => {
    expect(isMarkedApiError(value)).toBe(false);
  });
});
