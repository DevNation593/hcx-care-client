import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeJwt } from '@/test/fake-jwt';
import { isMarkedApiError } from '@/lib/monitoring/api-error-marker';

type Rejected = (error: unknown) => Promise<unknown>;

const mocks = vi.hoisted(() => ({
  rejected: undefined as Rejected | undefined,
  instances: [] as Array<ReturnType<typeof vi.fn>>,
  post: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: () => {
      const instance = Object.assign(
        vi.fn(async (request: unknown) => ({ data: 'retried', config: request })),
        {
          interceptors: {
            request: { use: vi.fn() },
            response: {
              use: (_ok: unknown, rejected: Rejected) => {
                mocks.rejected = rejected;
              },
            },
          },
        },
      );
      mocks.instances.push(instance);
      return instance;
    },
    post: mocks.post,
  },
}));

type ClientModule = typeof import('./client');

/** A fresh copy of the module, as another tab (or a reload) would have. */
const load = async (): Promise<{
  apiClient: ClientModule['apiClient'];
  rejected: Rejected;
  retried: ReturnType<typeof vi.fn>;
}> => {
  vi.resetModules();
  const apiClient = (await import('./client')).apiClient;
  return {
    apiClient,
    rejected: mocks.rejected!,
    retried: mocks.instances[mocks.instances.length - 1],
  };
};

const inSeconds = (seconds: number) => Math.floor(Date.now() / 1000) + seconds;
const validToken = () => fakeJwt({ exp: inSeconds(900), jti: Math.random().toString() });
const expiredToken = () => fakeJwt({ exp: inSeconds(-60) });
const unauthorized = (token: string | null, url = '/tenants/t1/patients') => ({
  config: { url, headers: token ? { Authorization: `Bearer ${token}` } : {} },
  response: { status: 401, data: { message: 'Tu sesión expiró' } },
});

const setLocks = (locks: unknown) =>
  Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });

describe('refresh that does not end the session', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    mocks.post.mockReset();
    mocks.instances.length = 0;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/dashboard', href: '/dashboard' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    setLocks(undefined);
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  describe.each([
    ['a network error', { request: {}, message: 'Network Error' }, undefined],
    ['a 503', { response: { status: 503, data: { message: 'Servicio no disponible' } } }, 503],
    ['a 429', { response: { status: 429, data: { message: 'Demasiadas solicitudes' } } }, 429],
    ['a 500', { response: { status: 500, data: {} } }, 500],
  ])('when the refresh fails with %s', (_name, failure, status) => {
    it('keeps the session, does not redirect, and fails the request with the real cause', async () => {
      const { rejected } = await load();
      const stale = expiredToken();
      localStorage.setItem('access_token', stale);
      localStorage.setItem('user', '{"id":"u1"}');
      mocks.post.mockRejectedValue(failure);

      const error = await rejected(unauthorized(stale)).catch((e: unknown) => e);

      if (status) expect(error).toMatchObject({ status });
      else expect(error).toMatchObject({ code: 'NETWORK_ERROR' });
      // Sentry drops the rejections of the API client by this marker.
      expect(isMarkedApiError(error)).toBe(true);
      expect(localStorage.getItem('access_token')).toBe(stale);
      expect(localStorage.getItem('user')).toBe('{"id":"u1"}');
      expect(window.location.href).toBe('/dashboard');
    });

    it('rejects the queued requests too, and the next request refreshes again', async () => {
      const { rejected, retried } = await load();
      const stale = expiredToken();
      localStorage.setItem('access_token', stale);
      let fail!: (reason: unknown) => void;
      mocks.post.mockReturnValueOnce(new Promise((_resolve, reject) => (fail = reject)));

      const first = rejected(unauthorized(stale, '/tenants/t1/patients')).catch((e: unknown) => e);
      const queued = rejected(unauthorized(stale, '/tenants/t1/tasks')).catch((e: unknown) => e);
      await Promise.resolve();
      fail(failure);

      // Neither of them hangs.
      const outcomes = await Promise.all([first, queued]);
      for (const outcome of outcomes) {
        expect(outcome).toMatchObject(status ? { status } : { code: 'NETWORK_ERROR' });
        expect(isMarkedApiError(outcome)).toBe(true);
      }
      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe('/dashboard');

      // A later request is not stuck behind the failed refresh.
      const fresh = validToken();
      mocks.post.mockResolvedValueOnce({ data: { accessToken: fresh } });
      await expect(rejected(unauthorized(stale, '/tenants/t1/later'))).resolves.toMatchObject({
        data: 'retried',
      });
      expect(retried).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('access_token')).toBe(fresh);
    });
  });

  it.each([401, 403])('ends the session and rejects the queued requests when the API answers %i', async (status) => {
    const { rejected } = await load();
    const stale = expiredToken();
    localStorage.setItem('access_token', stale);
    localStorage.setItem('user', '{"id":"u1"}');
    let fail!: (reason: unknown) => void;
    mocks.post.mockReturnValue(new Promise((_resolve, reject) => (fail = reject)));

    const first = rejected(unauthorized(stale, '/tenants/t1/patients')).catch((e: unknown) => e);
    const queued = rejected(unauthorized(stale, '/tenants/t1/tasks')).catch((e: unknown) => e);
    await Promise.resolve();
    fail({ response: { status, data: {} } });

    const [firstError, queuedError] = [await first, await queued];
    expect(firstError).toMatchObject({ status: 401 });
    expect(queuedError).toMatchObject({ status: 401 });
    expect(isMarkedApiError(firstError)).toBe(true);
    expect(isMarkedApiError(queuedError)).toBe(true);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  describe('a refresh that never answers', () => {
    it('is sent with the request timeout, so axios gives up', async () => {
      const { apiClient } = await load();
      mocks.post.mockResolvedValue({ data: { accessToken: validToken() } });

      await apiClient.restoreSession();

      expect(mocks.post.mock.calls[0][2]).toMatchObject({ timeout: 30000, withCredentials: true });
    });

    it('does not hold the start-up: the session is kept and the next attempt starts a new refresh', async () => {
      vi.useFakeTimers();
      const { apiClient } = await load();
      localStorage.setItem('access_token', expiredToken());
      // Behaves like axios: rejects with a timeout error when `timeout` elapses.
      mocks.post.mockImplementation(
        (_url: string, _body: unknown, config: { timeout: number }) =>
          new Promise((_resolve, reject) =>
            setTimeout(() => reject({ code: 'ECONNABORTED', request: {} }), config.timeout),
          ),
      );

      const restore = apiClient.restoreSession();
      await vi.advanceTimersByTimeAsync(30000);
      await expect(restore).resolves.toBe('unavailable');
      expect(localStorage.getItem('access_token')).not.toBeNull();

      mocks.post.mockResolvedValue({ data: { accessToken: validToken() } });
      await expect(apiClient.restoreSession()).resolves.toBe('active');
      expect(mocks.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('with the Web Locks API', () => {
    /** A lock manager that grants the lock to one holder at a time, in order. */
    const mutex = () => {
      let tail: Promise<unknown> = Promise.resolve();
      return {
        request: vi.fn((_name: string, optionsOrCallback: unknown, maybeCallback?: unknown) => {
          const callback = (maybeCallback ?? optionsOrCallback) as (lock: unknown) => unknown;
          const run = tail.then(() => callback({ name: _name }));
          tail = run.catch(() => undefined);
          return run;
        }),
      };
    };

    it('takes the refresh under the shared lock', async () => {
      const locks = mutex();
      setLocks(locks);
      const { apiClient } = await load();
      mocks.post.mockResolvedValue({ data: { accessToken: validToken() } });

      await apiClient.restoreSession();

      expect(locks.request).toHaveBeenCalledTimes(1);
      expect(locks.request.mock.calls[0][0]).toBe('hcx-refresh-session');
    });

    it('lets a second tab reuse the access token the first one just obtained instead of rotating the cookie again', async () => {
      setLocks(mutex());
      const tabA = await load();
      const tabB = await load();
      const stale = expiredToken();
      localStorage.setItem('access_token', stale);
      const fresh = validToken();
      let answer!: (value: unknown) => void;
      mocks.post.mockReturnValue(new Promise((resolve) => (answer = resolve)));

      // Both tabs see the same rejected token at the same time.
      const a = tabA.rejected(unauthorized(stale, '/tenants/t1/patients'));
      const b = tabB.rejected(unauthorized(stale, '/tenants/t1/tasks'));
      await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
      answer({ data: { accessToken: fresh } });
      await Promise.all([a, b]);

      // One rotation of the cookie only, and both requests repeat with that token.
      expect(mocks.post).toHaveBeenCalledTimes(1);
      for (const retried of [tabA.retried, tabB.retried]) {
        expect(retried).toHaveBeenCalledTimes(1);
        expect(retried.mock.calls[0][0].headers.Authorization).toBe(`Bearer ${fresh}`);
      }
    });

    /** A lock manager whose lock another tab never releases: the request ends only by its signal. */
    const stuckLocks = () => ({
      request: vi.fn(
        (_name: string, options: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener('abort', () =>
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
            ),
          ),
      ),
    });

    it('gives up waiting for a lock that another tab never releases', async () => {
      vi.useFakeTimers();
      const locks = stuckLocks();
      setLocks(locks);
      const { apiClient } = await load();
      localStorage.setItem('access_token', expiredToken());

      let settled = false;
      const restore = apiClient.restoreSession().finally(() => {
        settled = true;
      });
      expect(locks.request).toHaveBeenCalledWith(
        'hcx-refresh-session',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
        expect.any(Function),
      );

      // It keeps waiting for the whole timeout and gives up right at the end of it.
      await vi.advanceTimersByTimeAsync(29_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      await expect(restore).resolves.toBe('unavailable');
      expect(mocks.post).not.toHaveBeenCalled();
      expect(localStorage.getItem('access_token')).not.toBeNull();
    });

    it('uses the token another tab stored while it waited for the lock, instead of failing the request', async () => {
      vi.useFakeTimers();
      setLocks(stuckLocks());
      const { rejected, retried } = await load();
      const stale = expiredToken();
      localStorage.setItem('access_token', stale);
      const fresh = validToken();

      const outcome = rejected(unauthorized(stale));
      // The tab that held the lock refreshed meanwhile and stored its token.
      localStorage.setItem('access_token', fresh);
      await vi.advanceTimersByTimeAsync(30_000);

      await expect(outcome).resolves.toMatchObject({ data: 'retried' });
      expect(mocks.post).not.toHaveBeenCalled();
      expect(retried).toHaveBeenCalledTimes(1);
      expect(retried.mock.calls[0][0].headers.Authorization).toBe(`Bearer ${fresh}`);
      expect(localStorage.getItem('access_token')).toBe(fresh);
    });

    it('restores the session with the token another tab stored while it waited for the lock', async () => {
      vi.useFakeTimers();
      setLocks(stuckLocks());
      const { apiClient } = await load();
      localStorage.setItem('access_token', expiredToken());

      const restore = apiClient.restoreSession();
      localStorage.setItem('access_token', validToken());
      await vi.advanceTimersByTimeAsync(30_000);

      await expect(restore).resolves.toBe('active');
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it('still fails with the timeout when the token after the wait is the stale one', async () => {
      vi.useFakeTimers();
      setLocks(stuckLocks());
      const { rejected } = await load();
      const stale = expiredToken();
      localStorage.setItem('access_token', stale);

      const outcome = rejected(unauthorized(stale)).catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(30_000);

      // A wait that ends without a better token says nothing about the session: it is kept.
      const error = await outcome;
      expect(error).toMatchObject({ code: 'UNKNOWN_ERROR' });
      expect(isMarkedApiError(error)).toBe(true);
      expect(localStorage.getItem('access_token')).toBe(stale);
      expect(window.location.href).toBe('/dashboard');
    });
  });
});
