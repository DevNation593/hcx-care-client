import { describe, expect, it } from 'vitest';
import { UserRole } from '@/types';
import { postLoginRoute } from './post-login-route';

describe('postLoginRoute', () => {
  it('sends a user with a temporary password to /change-password whatever the role', () => {
    for (const role of Object.values(UserRole)) {
      expect(postLoginRoute({ role, mustChangePassword: true })).toBe('/change-password');
    }
  });

  it('sends a CAJERO to /cash', () => {
    expect(postLoginRoute({ role: UserRole.CAJERO, mustChangePassword: false })).toBe('/cash');
    expect(postLoginRoute({ role: UserRole.CAJERO })).toBe('/cash');
  });

  it('sends ADMIN to /platform and everyone else to /dashboard', () => {
    expect(postLoginRoute({ role: UserRole.ADMIN, mustChangePassword: false })).toBe('/platform');
    expect(postLoginRoute({ role: UserRole.ADMIN })).toBe('/platform');
    for (const role of Object.values(UserRole).filter(
      (r) => r !== UserRole.ADMIN && r !== UserRole.CAJERO,
    )) {
      expect(postLoginRoute({ role, mustChangePassword: false })).toBe('/dashboard');
      expect(postLoginRoute({ role })).toBe('/dashboard');
    }
  });
});
