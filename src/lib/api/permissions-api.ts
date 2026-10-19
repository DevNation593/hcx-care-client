import { apiClient } from './client';

export interface UserPermissionEntry {
  key: string;
  group: string;
  label: string;
  /** Whether this role has it in this clinic. */
  allowed: boolean;
  /** 'role': enabled by default. 'grant': available through platform configuration. */
  source: 'role' | 'grant';
}

export interface UserPermissions {
  userId: string;
  role: string;
  effective: string[];
  permissions: UserPermissionEntry[];
}

const path = (tenantId: string, userId: string) =>
  `/tenants/${tenantId}/users/${userId}/permissions`;

export const userPermissionsApi = {
  /** Reads the signed-in user's effective role permissions. */
  get: (tenantId: string, userId: string) => apiClient.get<UserPermissions>(path(tenantId, userId)),
};
