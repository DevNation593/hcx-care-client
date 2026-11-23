'use client';

import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, extractArray, extractPage, type TaskPageParams } from '@/lib/api/endpoints';
import { DEFAULT_PAGE_SIZE, QUERY_KEYS } from '@/lib/constants';
import { Task, TaskStatus } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { requireTenantId, useTenantId } from './useTenantScope';
import { isFeatureLockedError } from '@/features/subscription/feature-locked-notice';

const retryUnlessLocked = (failureCount: number, error: unknown) =>
  !isFeatureLockedError(error) && failureCount < 1;

export function useTasks(params?: Parameters<typeof tasksApi.list>[0]) {
  return useQuery({
    queryKey: [...QUERY_KEYS.TASKS, params],
    queryFn: async () => {
      const response = await tasksApi.list(params);
      return extractArray(response);
    },
    retry: retryUnlessLocked,
  });
}

/** One page of the task list, filtered and paged by the server; the previous page stays while the next one loads. */
export function useTasksPage(params: {
  search?: string;
  status?: string;
  priority?: string;
  page: number;
  limit?: number;
}) {
  const tenantId = useTenantId();
  const request: TaskPageParams = {
    search: params.search?.trim() || undefined,
    status: params.status,
    priority: params.priority,
    page: params.page,
    limit: params.limit ?? DEFAULT_PAGE_SIZE,
  };
  return useQuery({
    queryKey: QUERY_KEYS.TASKS_PAGE(tenantId ?? '', request),
    queryFn: async () =>
      extractPage(await tasksApi.listPage(request, requireTenantId(tenantId)), request),
    enabled: !!tenantId,
    retry: retryUnlessLocked,
    placeholderData: keepPreviousData,
  });
}

/** Counts per state under the same search and priority as the list; they do not depend on the page. */
export function useTaskSummary(params: { search?: string; priority?: string }) {
  const tenantId = useTenantId();
  const request = { search: params.search?.trim() || undefined, priority: params.priority };
  return useQuery({
    queryKey: QUERY_KEYS.TASKS_SUMMARY(tenantId ?? '', request),
    queryFn: () => tasksApi.summary(request, requireTenantId(tenantId)),
    enabled: !!tenantId,
    retry: retryUnlessLocked,
    placeholderData: keepPreviousData,
  });
}

export function useMyTasks() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: [...QUERY_KEYS.TASKS_MY, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await tasksApi.list({ assignedToId: user.id });
      return extractArray(response);
    },
    enabled: !!user?.id,
    retry: retryUnlessLocked,
  });
}

export function useOverdueTasks() {
  return useQuery({
    queryKey: QUERY_KEYS.TASKS_OVERDUE,
    queryFn: async () => {
      const response = await tasksApi.list({ status: TaskStatus.PENDING });
      const tasks = extractArray(response);
      return tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== TaskStatus.COMPLETED
      );
    },
    retry: retryUnlessLocked,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.TASK_DETAIL(id),
    queryFn: () => tasksApi.get(id),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Task>) => tasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS_MY });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS_OVERDUE });
      toast.success('Actividad creada exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al crear actividad');
    },
  });
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Task>) => tasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASK_DETAIL(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS_MY });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS_OVERDUE });
      toast.success('Actividad actualizada');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al actualizar actividad');
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS_MY });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS_OVERDUE });
      toast.success('Actividad eliminada');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al eliminar actividad');
    },
  });
}

export function useCompleteTask(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      tasksApi.update(id, { status: TaskStatus.COMPLETED, completedAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASK_DETAIL(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS_MY });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS_OVERDUE });
      toast.success('Actividad completada');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al completar actividad');
    },
  });
}
