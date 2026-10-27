import { describe, expect, it } from 'vitest';
import { isCashierPath } from './cashier-routes';

describe('isCashierPath', () => {
  it.each(['/cash', '/cash/orders/abc', '/admin/billing', '/inventory', '/profile'])(
    'allows %s',
    (path) => expect(isCashierPath(path)).toBe(true),
  );

  it.each(['/cashier', '/dashboard', '/patients', '/admin/team', '/admin/billing-x'])(
    'rejects %s',
    (path) => expect(isCashierPath(path)).toBe(false),
  );
});
