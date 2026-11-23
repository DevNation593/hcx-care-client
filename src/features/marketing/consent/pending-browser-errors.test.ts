import * as Sentry from '@sentry/nextjs';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBrowserReportingAllowed } from '@/lib/monitoring/browser-gate';
import { resetConsent, writeConsent } from './consent';
import {
  clearPendingBrowserErrors,
  drainPendingBrowserErrors,
  flushPendingBrowserErrors,
  reportMarketingError,
} from './pending-browser-errors';

vi.mock('@sentry/nextjs', () => ({ getClient: vi.fn(), captureException: vi.fn() }));

function ready(isReady: boolean) {
  vi.mocked(Sentry.getClient).mockReturnValue(isReady ? ({} as ReturnType<typeof Sentry.getClient>) : undefined);
  setBrowserReportingAllowed(isReady);
}

beforeEach(() => {
  window.localStorage.clear();
  act(() => resetConsent());
  ready(false);
  clearPendingBrowserErrors();
  vi.mocked(Sentry.captureException).mockClear();
});
afterEach(() => {
  setBrowserReportingAllowed(false);
  clearPendingBrowserErrors();
});

describe('reportMarketingError', () => {
  it('captures right away when the client exists and reporting is allowed', () => {
    ready(true);
    const error = new Error('now');

    reportMarketingError(error);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(drainPendingBrowserErrors()).toEqual([]);
  });

  it('queues when there is no client yet and consent is already accepted', () => {
    act(() => writeConsent('accepted'));
    const error = new Error('early');

    reportMarketingError(error);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(drainPendingBrowserErrors()).toEqual([error]);
  });

  it('queues when the client exists but the gate is still closed', () => {
    act(() => writeConsent('accepted'));
    vi.mocked(Sentry.getClient).mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    const error = new Error('gate closed');

    reportMarketingError(error);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(drainPendingBrowserErrors()).toEqual([error]);
  });

  it.each(['unset', 'rejected'] as const)('drops the error when consent is %s at that moment', (state) => {
    if (state === 'rejected') act(() => writeConsent('rejected'));

    reportMarketingError(new Error('before consent'));
    act(() => writeConsent('accepted'));

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(drainPendingBrowserErrors()).toEqual([]);
  });

  it('keeps only the 5 most recent errors', () => {
    act(() => writeConsent('accepted'));
    const errors = Array.from({ length: 7 }, (_, i) => new Error(`e${i}`));

    for (const error of errors) reportMarketingError(error);

    expect(drainPendingBrowserErrors()).toEqual(errors.slice(2));
  });

  it('does not queue the same error twice', () => {
    act(() => writeConsent('accepted'));
    const error = new Error('twice');

    reportMarketingError(error);
    reportMarketingError(error);

    expect(drainPendingBrowserErrors()).toEqual([error]);
  });

  it('does not capture an error that was already captured', () => {
    ready(true);
    const error = new Error('once');

    reportMarketingError(error);
    reportMarketingError(error);
    ready(false);
    act(() => writeConsent('accepted'));
    reportMarketingError(error);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(drainPendingBrowserErrors()).toEqual([]);
  });
});

describe('drain, clear and flush', () => {
  it('drain returns the queue and empties it', () => {
    act(() => writeConsent('accepted'));
    reportMarketingError(new Error('a'));

    expect(drainPendingBrowserErrors()).toHaveLength(1);
    expect(drainPendingBrowserErrors()).toEqual([]);
  });

  it('clear empties the queue', () => {
    act(() => writeConsent('accepted'));
    reportMarketingError(new Error('a'));

    clearPendingBrowserErrors();

    expect(drainPendingBrowserErrors()).toEqual([]);
  });

  it('flush captures each pending error exactly once and empties the queue', () => {
    act(() => writeConsent('accepted'));
    const [a, b] = [new Error('a'), new Error('b')];
    reportMarketingError(a);
    reportMarketingError(b);
    ready(true);

    flushPendingBrowserErrors();
    flushPendingBrowserErrors();
    reportMarketingError(a);

    expect(vi.mocked(Sentry.captureException).mock.calls).toEqual([[a], [b]]);
  });
});
