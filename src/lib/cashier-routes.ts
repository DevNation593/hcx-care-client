/** The only dashboard pages a cashier may open. */
export const CASHIER_PATHS = ['/cash', '/admin/billing', '/inventory', '/profile'] as const;

/** True for an allowed path itself or anything below it. */
export function isCashierPath(pathname: string): boolean {
  return CASHIER_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
