import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeJwt } from '@/test/fake-jwt';

const mocks = vi.hoisted(() => ({
  createConfig: undefined as Record<string, any> | undefined,
  rejected: undefined as ((error: unknown) => Promise<unknown>) | undefined,
  instance: undefined as any,
  post: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: (config: Record<string, any>) => {
      mocks.createConfig = config;
      mocks.instance = Object.assign(
        vi.fn(async (request: unknown) => ({ data: 'retried', config: request })),
        {
          interceptors: {
            request: { use: vi.fn() },
            response: {
              use: (_ok: unknown, rejected: (error: unknown) => Promise<unknown>) => {
                mocks.rejected = rejected;
              },
            },
          },
          post: vi.fn(),
        },
      );
      return mocks.instance;
    },
    post: mocks.post,
  },
}));

type ClientModule = typeof import('./client');
const load = async (): Promise<ClientModule['apiClient']> => {
  vi.resetModules();
  return (await import('./client')).apiClient;
};

const inSeconds = (seconds: number) => Math.floor(Date.now() / 1000) + seconds;
const validToken = () => fakeJwt({ exp: inSeconds(900) });
const expiredToken = () => fakeJwt({ exp: inSeconds(-60) });
const unauthorized = (token: string | null, url = '/tenants/t1/patients') => ({
  config: { url, headers: token ? { Authorization: `Bearer ${token}` } : {} },
  response: { status: 401, data: {} },
});

describe('web session without a readable refresh token', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    mocks.post.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/dashboard', href: '/dashboard' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('sends credentials and X-Client: web on every call to the API', async () => {
    await load();
    expect(mocks.createConfig).toMatchObject({
      withCredentials: true,
      headers: { 'X-Client': 'web', 'Content-Type': 'application/json' },
    });
  });

  it('erases the refresh token that earlier versions left in localStorage when it loads', async () => {
    localStorage.setItem('refresh_token', 'legacy.refresh.jwt');
    localStorage.setItem('access_token', 'kept');

    await load();

    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBe('kept');
  });

  it('stores only the access token on sign-in and drops a legacy refresh token', async () => {
    const apiClient = await load();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    localStorage.setItem('refresh_token', 'legacy.refresh.jwt');

    apiClient.setAccessToken('new.access.jwt');

    expect(setItem).toHaveBeenCalledTimes(2); // the legacy fixture above and the access token
    expect(setItem).not.toHaveBeenCalledWith('refresh_token', 'new.access.jwt');
    expect(localStorage.getItem('access_token')).toBe('new.access.jwt');
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('refreshes a rejected request through the cookie, with no body and without storing a refresh token', async () => {
    const apiClient = await load();
    const stale = expiredToken();
    localStorage.setItem('access_token', stale);
    const fresh = validToken();
    mocks.post.mockResolvedValue({ data: { accessToken: fresh } });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    const result = await mocks.rejected!(unauthorized(stale));

    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mocks.post.mock.calls[0];
    expect(url).toMatch(/\/auth\/refresh$/);
    expect(body).toBeUndefined();
    expect(config).toEqual({ withCredentials: true, headers: { 'X-Client': 'web' }, timeout: 30000 });
    expect(localStorage.getItem('access_token')).toBe(fresh);
    expect(setItem.mock.calls.map(([key]) => key)).toEqual(['access_token']);
    expect(localStorage.getItem('refresh_token')).toBeNull();
    // The rejected request is repeated with the new token.
    expect(result).toMatchObject({ data: 'retried' });
    expect(mocks.instance).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { Authorization: `Bearer ${fresh}` } }),
    );
    expect(apiClient).toBeDefined();
  });

  it('queues the requests rejected while a refresh runs and repeats them with the same new token', async () => {
    await load();
    const stale = expiredToken();
    localStorage.setItem('access_token', stale);
    const fresh = validToken();
    let finish!: (value: unknown) => void;
    mocks.post.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = mocks.rejected!(unauthorized(stale, '/tenants/t1/patients'));
    const second = mocks.rejected!(unauthorized(stale, '/tenants/t1/tasks'));
    const third = mocks.rejected!(unauthorized(stale, '/tenants/t1/appointments'));
    finish({ data: { accessToken: fresh } });
    await Promise.all([first, second, third]);

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.instance).toHaveBeenCalledTimes(3);
    for (const [request] of mocks.instance.mock.calls) {
      expect(request.headers.Authorization).toBe(`Bearer ${fresh}`);
    }
  });

  it('does not rotate the cookie again when another tab already stored a newer access token', async () => {
    await load();
    const stale = expiredToken();
    const newer = validToken();
    localStorage.setItem('access_token', newer);

    await mocks.rejected!(unauthorized(stale));

    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.instance).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { Authorization: `Bearer ${newer}` } }),
    );
  });

  it('clears the session and goes to /login when the refresh cookie is refused', async () => {
    await load();
    localStorage.setItem('access_token', expiredToken());
    localStorage.setItem('user', '{}');
    mocks.post.mockRejectedValue({ response: { status: 401, data: {} } });

    await expect(mocks.rejected!(unauthorized(expiredToken()))).rejects.toMatchObject({
      status: 401,
    });

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('never tries to refresh when the refresh call itself answers 401', async () => {
    await load();

    await expect(
      mocks.rejected!(unauthorized(null, '/auth/refresh')),
    ).rejects.toMatchObject({ status: 401 });

    expect(mocks.post).not.toHaveBeenCalled();
  });

  describe('restoreSession', () => {
    it('does nothing while the access token is still valid', async () => {
      const apiClient = await load();
      localStorage.setItem('access_token', validToken());

      await expect(apiClient.restoreSession()).resolves.toBe('active');

      expect(mocks.post).not.toHaveBeenCalled();
    });

    it.each([
      ['expired', () => expiredToken()],
      ['missing', () => null],
    ])('refreshes through the cookie when the access token is %s', async (_name, token) => {
      const apiClient = await load();
      const current = token();
      if (current) localStorage.setItem('access_token', current);
      const fresh = validToken();
      mocks.post.mockResolvedValue({ data: { accessToken: fresh } });

      await expect(apiClient.restoreSession()).resolves.toBe('active');

      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('access_token')).toBe(fresh);
    });

    it('reports the session as expired when the API answers 401', async () => {
      const apiClient = await load();
      mocks.post.mockRejectedValue({ response: { status: 401 } });

      await expect(apiClient.restoreSession()).resolves.toBe('expired');
    });

    it('keeps the session when the API cannot be reached or fails', async () => {
      const apiClient = await load();
      mocks.post.mockRejectedValueOnce({ request: {} });
      await expect(apiClient.restoreSession()).resolves.toBe('unavailable');
      mocks.post.mockRejectedValueOnce({ response: { status: 503 } });
      await expect(apiClient.restoreSession()).resolves.toBe('unavailable');
    });

    it('shares one refresh between a start-up restore and a request rejected at the same time', async () => {
      const apiClient = await load();
      const stale = expiredToken();
      localStorage.setItem('access_token', stale);
      let finish!: (value: unknown) => void;
      mocks.post.mockReturnValue(new Promise((resolve) => (finish = resolve)));

      const restore = apiClient.restoreSession();
      const rejected = mocks.rejected!(unauthorized(stale));
      finish({ data: { accessToken: validToken() } });
      await Promise.all([restore, rejected]);

      expect(mocks.post).toHaveBeenCalledTimes(1);
    });
  });
});
