import { afterEach, describe, expect, it } from 'vitest';
import { isBrowserReportingAllowed, setBrowserReportingAllowed } from './browser-gate';

afterEach(() => setBrowserReportingAllowed(false));

describe('browser reporting gate', () => {
  it('is closed by default', () => {
    expect(isBrowserReportingAllowed()).toBe(false);
  });

  it('opens and closes on demand', () => {
    setBrowserReportingAllowed(true);
    expect(isBrowserReportingAllowed()).toBe(true);
    setBrowserReportingAllowed(false);
    expect(isBrowserReportingAllowed()).toBe(false);
  });
});
