'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTasks, useCreateTask, useDeleteTask } from '@/hooks/useTasks';
import { usePagination } from '@/hooks/usePagination';
import { tasksApi, usersApi, patientsApi, extractArray } from '@/lib/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { assignableUsers } from '@/features/tasks/task-assignees';
import { FeatureLockedNotice, isFeatureLockedError } from '@/features/subscription/feature-locked-notice';
import { QUERY_KEYS, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from '@/lib/constants';
import { TaskStatus, TaskPriority, UserRole } from '@/types';
import type { Task } from '@/types';
import { formatDate, formatRelativeDate, cn } from '@/lib/utils';
import { taskSchema, type TaskFormData } from '@/lib/validations/schemas';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Calendar,
  User as UserIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ==========================================
// FILTER TYPES
// ==========================================
type StatusFilter = 'ALL' | TaskStatus;
type PriorityFilter = 'ALL' | TaskPriority;

// ==========================================
// MAIN PAGE
// ==========================================
function TasksPageContent() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  // Fetch tasks
  const { data: tasks, isLoading, error: tasksError } = useTasks();
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask();

  // Complete task mutation
  const completeTask = useMutation({
    mutationFn: (id: string) =>
      tasksApi.update(id, { status: TaskStatus.COMPLETED }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS_MY });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS_OVERDUE });
      toast.success('Actividad completada');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al completar actividad');
    },
  });

  // Filter and search
  const filteredTasks = (tasks || []).filter((task) => {
    const matchesSearch =
      !search ||
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.description?.toLowerCase().includes(search.toLowerCase()) ||
      task.patient?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      task.patient?.lastName?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Group tasks
  const pendingTasks = filteredTasks.filter(
    (t) => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS
  );
  const completedTasks = filteredTasks.filter((t) => t.status === TaskStatus.COMPLETED);
  const cancelledTasks = filteredTasks.filter((t) => t.status === TaskStatus.CANCELLED);

  // Pages run through the groups in order, so the headings keep counting the whole list.
  const pagination = usePagination([...pendingTasks, ...completedTasks, ...cancelledTasks], {
    resetKey: `${search}|${statusFilter}|${priorityFilter}`,
  });
  const pageTaskIds = new Set(pagination.pageItems.map((task) => task.id));
  const onPage = (task: Task) => pageTaskIds.has(task.id);
  const pagePendingTasks = pendingTasks.filter(onPage);
  const pageCompletedTasks = completedTasks.filter(onPage);
  const pageCancelledTasks = cancelledTasks.filter(onPage);

  const handleDelete = () => {
    if (deleteTaskId) {
      deleteTask(deleteTaskId, {
        onSuccess: () => setDeleteTaskId(null),
      });
    }
  };

  const isOverdue = (task: Task): boolean =>
    !!(task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== TaskStatus.COMPLETED &&
    task.status !== TaskStatus.CANCELLED);

  if (isFeatureLockedError(tasksError)) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Actividades</h1>
        <FeatureLockedNotice featureName="El módulo de actividades" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Actividades</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona las actividades del equipo
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Actividad
        </Button>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar actividades..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>

          {showFilters && (
            <div className="flex gap-4 mt-4 pt-4 border-t">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <div className="flex gap-1 flex-wrap">
                  <Button
                    variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('ALL')}
                  >
                    Todos
                  </Button>
                  {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={statusFilter === key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(key as TaskStatus)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Prioridad</Label>
                <div className="flex gap-1 flex-wrap">
                  <Button
                    variant={priorityFilter === 'ALL' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPriorityFilter('ALL')}
                  >
                    Todas
                  </Button>
                  {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={priorityFilter === key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPriorityFilter(key as TaskPriority)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{pendingTasks.length}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {pendingTasks.filter((t) => isOverdue(t)).length}
                </p>
                <p className="text-xs text-muted-foreground">Vencidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{completedTasks.length}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-2xl font-bold">{cancelledTasks.length}</p>
                <p className="text-xs text-muted-foreground">Canceladas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No hay actividades</p>
              <p className="text-sm mt-1">
                {search || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                  ? 'No se encontraron actividades con esos filtros'
                  : 'Crea tu primera actividad para empezar'}
              </p>
              {!search && statusFilter === 'ALL' && priorityFilter === 'ALL' && (
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Actividad
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pending / In Progress */}
          {pagePendingTasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Activas ({pendingTasks.length})
              </h2>
              {pagePendingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOverdue={isOverdue(task)}
                  onComplete={() => completeTask.mutate(task.id)}
                  onDelete={() => setDeleteTaskId(task.id)}
                />
              ))}
            </div>
          )}

          {/* Completed */}
          {pageCompletedTasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5" />
                Completadas ({completedTasks.length})
              </h2>
              {pageCompletedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOverdue={false}
                  onDelete={() => setDeleteTaskId(task.id)}
                />
              ))}
            </div>
          )}

          {/* Cancelled */}
          {pageCancelledTasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                <X className="h-5 w-5" />
                Canceladas ({cancelledTasks.length})
              </h2>
              {pageCancelledTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOverdue={false}
                  onDelete={() => setDeleteTaskId(task.id)}
                />
              ))}
            </div>
          )}

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        </div>
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La actividad será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==========================================
// TASK CARD COMPONENT
// ==========================================
function TaskCard({
  task,
  isOverdue,
  onComplete,
  onDelete,
}: {
  task: Task;
  isOverdue: boolean;
  onComplete?: () => void;
  onDelete: () => void;
}) {
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const isCancelled = task.status === TaskStatus.CANCELLED;

  return (
    <Card className={cn(
      'transition-colors',
      isOverdue && 'border-red-200 bg-red-50/50',
      isCompleted && 'opacity-70',
      isCancelled && 'opacity-50',
    )}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isOverdue && (
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              {isCompleted && (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              )}
              <p className={cn(
                'font-medium truncate',
                isCompleted && 'line-through text-muted-foreground',
              )}>
                {task.title}
              </p>
              <Badge className={TASK_PRIORITY_COLORS[task.priority]} variant="outline">
                {TASK_PRIORITY_LABELS[task.priority]}
              </Badge>
              <Badge variant="outline">
                {TASK_STATUS_LABELS[task.status]}
              </Badge>
            </div>

            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {task.patient && (
                <span className="flex items-center gap-1">
                  <UserIcon className="h-3 w-3" />
                  {task.patient.firstName} {task.patient.lastName}
                </span>
              )}
              {task.assignedTo && (
                <span className="flex items-center gap-1">
                  <UserIcon className="h-3 w-3" />
                  Asignada a: {task.assignedTo.firstName} {task.assignedTo.lastName}
                </span>
              )}
              {task.dueDate && (
                <span className={cn(
                  'flex items-center gap-1',
                  isOverdue && 'text-red-600 font-medium',
                )}>
                  <Calendar className="h-3 w-3" />
                  {isOverdue ? `Vencida ${formatRelativeDate(task.dueDate)}` : `Vence ${formatDate(task.dueDate, 'dd/MM/yyyy')}`}
                </span>
              )}
              {task.completedAt && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Completada {formatDate(task.completedAt, 'dd/MM/yyyy')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onComplete && !isCompleted && !isCancelled && (
              <Button variant="ghost" size="sm" onClick={onComplete}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Completar
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// CREATE TASK DIALOG
// ==========================================
function CreateTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutate: createTask, isPending } = useCreateTask();
  const actor = useAuthStore((state) => state.user);

  const { data: users } = useQuery({
    queryKey: [...QUERY_KEYS.USERS, 'active'],
    queryFn: async () => {
      const response = await usersApi.list({ isActive: true });
      return extractArray(response);
    },
    enabled: open,
  });

  const { data: patients } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, 'active'],
    queryFn: async () => {
      const response = await patientsApi.list({ isActive: true });
      return extractArray(response);
    },
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      priority: TaskPriority.MEDIUM,
      // A professional's tasks are their own, so the assignee starts as themselves.
      ...(actor && actor.role === UserRole.PROFESIONAL && { assignedToId: actor.id }),
    },
  });

  const onSubmit = (data: TaskFormData) => {
    createTask(data, {
      onSuccess: () => {
        onOpenChange(false);
        reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva Actividad</DialogTitle>
          <DialogDescription>
            Crea una nueva actividad para el equipo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" required>Título</Label>
            <Input
              id="title"
              placeholder="Ej: Preparar informe de progreso"
              {...register('title')}
              error={errors.title?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Descripción detallada de la actividad..."
              rows={3}
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignedToId" required>Asignar a</Label>
              <select
                id="assignedToId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('assignedToId')}
              >
                <option value="">Seleccionar usuario</option>
                {assignableUsers(users, actor).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.role})
                  </option>
                ))}
              </select>
              {errors.assignedToId && (
                <p className="text-sm text-destructive">{errors.assignedToId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="patientId" required>Paciente</Label>
              <select
                id="patientId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('patientId')}
              >
                <option value="">Seleccionar paciente</option>
                {patients?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
              {errors.patientId && (
                <p className="text-sm text-destructive">{errors.patientId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridad</Label>
              <select
                id="priority"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('priority')}
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Fecha límite</Label>
              <Input id="dueDate" type="date" {...register('dueDate')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              Crear Actividad
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TasksPage() {
  return (
    <SectionGate section="core.agenda.tasks">
      <TasksPageContent />
    </SectionGate>
  );
}
