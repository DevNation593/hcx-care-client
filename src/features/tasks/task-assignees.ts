import { UserRole, type User } from '@/types';
import { isCashierRole } from '@/types/guards';

/**
 * Users a task may be assigned to by the actor. Professionals keep their tasks to
 * themselves (the API enforces the same rule); other roles may pick any clinic user.
 */
export function assignableUsers(users: User[] | undefined, actor: User | null): User[] {
  if (!actor) return [];
  // Tasks carry patient data: cashiers never receive them (the API refuses it too).
  if (actor.role !== UserRole.PROFESIONAL) {
    return (users ?? []).filter((user) => !isCashierRole(user.role));
  }
  return [users?.find((user) => user.id === actor.id) ?? actor];
}
