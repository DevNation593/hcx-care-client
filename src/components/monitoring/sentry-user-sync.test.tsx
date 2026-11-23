import { act, render } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';
import { SentryUserSync } from './sentry-user-sync';

vi.mock('@sentry/nextjs', () => ({ setUser: vi.fn(), setTag: vi.fn() }));

describe('SentryUserSync', () => {
  beforeEach(() => {
    vi.mocked(Sentry.setUser).mockClear();
    vi.mocked(Sentry.setTag).mockClear();
    useAuthStore.setState({ user: null });
  });

  it('sets only the user id and the tenantId tag when a user is logged in', () => {
    useAuthStore.setState({
      user: { id: 'u1', tenantId: 't1', email: 'a@b.c' } as User,
    });
    render(<SentryUserSync />);
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'u1' });
    expect(Sentry.setUser).not.toHaveBeenCalledWith(
      expect.objectContaining({ email: expect.anything() })
    );
    expect(Sentry.setTag).toHaveBeenCalledWith('tenantId', 't1');
  });

  it('clears user and tag after logout', () => {
    useAuthStore.setState({
      user: { id: 'u1', tenantId: 't1', email: 'a@b.c' } as User,
    });
    render(<SentryUserSync />);
    act(() => {
      useAuthStore.setState({ user: null });
    });
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
    expect(Sentry.setTag).toHaveBeenLastCalledWith('tenantId', undefined);
  });

  it('clears them when there is no user from the start', () => {
    render(<SentryUserSync />);
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
    expect(Sentry.setTag).toHaveBeenCalledWith('tenantId', undefined);
  });
});
