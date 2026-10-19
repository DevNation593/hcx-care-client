'use client';

import { useQuery } from '@tanstack/react-query';
import { userPermissionsApi } from '@/lib/api/permissions-api';
import { requireTenantId, useTenantId } from '@/hooks/useTenantScope';

const key = (tenantId: string, userId: string) => ['tenant', 'permissions', tenantId, userId];

/**
 * Whether the signed-in user's clinic role has a permission. While the answer is loading or cannot be read, `can` answers
 * `whileUnknown` (what the role alone would allow): the API is what enforces, this only hides
 * what would fail.
 */
export function useMyPermissions() {
  const tenantId = useTenantId();
  const query = useQuery({
    queryKey: key(tenantId ?? '', 'me'),
    queryFn: () => userPermissionsApi.get(requireTenantId(tenantId), 'me'),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
  const effective = query.data ? new Set(query.data.effective) : null;
  return {
    can: (permission: string, whileUnknown = true) =>
      effective ? effective.has(permission) : whileUnknown,
  };
}
