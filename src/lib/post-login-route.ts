import { ROUTES } from '@/lib/constants';
import type { User } from '@/types';
import { isCashierRole, isPlatformAdmin } from '@/types/guards';

/**
 * Where a signed-in user belongs: the forced password change comes before anything else, then the
 * two-factor setup the clinic requires.
 */
export function postLoginRoute(
  user: Pick<User, 'role' | 'mustChangePassword' | 'mfaEnrollmentRequired'>,
): string {
  if (user.mustChangePassword) return ROUTES.CHANGE_PASSWORD;
  if (user.mfaEnrollmentRequired) return ROUTES.MFA_ENROLLMENT;
  if (isPlatformAdmin(user)) return ROUTES.PLATFORM;
  if (isCashierRole(user.role)) return ROUTES.CASH;
  return ROUTES.DASHBOARD;
}
