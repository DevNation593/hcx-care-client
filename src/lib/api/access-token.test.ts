import { describe, expect, it } from 'vitest';
import { fakeJwt } from '@/test/fake-jwt';
import { accessTokenExpiry, isAccessTokenExpired } from './access-token';

describe('access token expiry', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  const at = (secondsFromNow: number) => Math.floor(now / 1000) + secondsFromNow;

  it('reads the exp claim of a base64url payload', () => {
    expect(accessTokenExpiry(fakeJwt({ exp: 1234567890, sub: 'user-1', note: '??>>' }))).toBe(1234567890);
  });

  it('answers null for anything that is not a JWT with a numeric exp', () => {
    expect(accessTokenExpiry('')).toBeNull();
    expect(accessTokenExpiry('not-a-jwt')).toBeNull();
    expect(accessTokenExpiry('a.%%%.c')).toBeNull();
    expect(accessTokenExpiry(fakeJwt({ sub: 'u1' }))).toBeNull();
    expect(accessTokenExpiry(fakeJwt({ exp: '123' }))).toBeNull();
  });

  it('counts a token as expired a little before its exp, and an unreadable one always', () => {
    expect(isAccessTokenExpired(fakeJwt({ exp: at(600) }), now)).toBe(false);
    expect(isAccessTokenExpired(fakeJwt({ exp: at(10) }), now)).toBe(true);
    expect(isAccessTokenExpired(fakeJwt({ exp: at(-5) }), now)).toBe(true);
    expect(isAccessTokenExpired('garbage', now)).toBe(true);
  });
});
