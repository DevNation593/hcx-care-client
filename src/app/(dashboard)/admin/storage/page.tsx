'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionGate } from '@/components/layout/section-gate';
import { RestrictedAccess } from '@/components/layout/restricted-access';
import { useCanManageAccount } from '@/hooks/useCanManageAccount';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/usePagination';
import { Progress } from '@/components/ui/progress';
import { Skeleton, SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import {
  HardDrive,
  Search,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  FileArchive,
  TrendingUp,
  AlertTriangle,
  ArrowUpDown,
  FileIcon,
  Info,
  FolderOpen,
  CreditCard,
} from 'lucide-react';
import { useStorageFiles, useStorageBreakdown, useDeleteFile } from '@/hooks/useStorage';
import { useSubscription, useUsageMetrics } from '@/hooks/useSubscription';
import { getRemainingStorageGB } from '@/types/guards';
import { ROUTES } from '@/lib/constants';
import type { StorageFile } from '@/types';

// ==========================================
// Helpers
// ==========================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateFull(date: string): string {
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  attachment: { label: 'Adjuntos', icon: <FileText className="h-4 w-4" />, color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  avatar: { label: 'Avatares', icon: <ImageIcon className="h-4 w-4" />, color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  export: { label: 'Exportaciones', icon: <FileArchive className="h-4 w-4" />, color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
};

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] || { label: category, icon: <FileIcon className="h-4 w-4" />, color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200' };
}

// ==========================================
// Subcomponents
// ==========================================

function StorageOverviewCard({
  usedGB,
  limitGB,
  remainingGB,
  breakdown,
  onUpgrade,
}: {
  usedGB: number;
  limitGB: number;
  remainingGB: number;
  breakdown: { attachments: number; avatars: number; exports: number } | null;
  onUpgrade: () => void;
}) {
  const percentage = limitGB > 0 ? Math.min((usedGB / limitGB) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;
  const isCritical = percentage >= 95;

  const getBarColor = () => {
    if (isCritical) return '[&>div]:bg-red-500';
    if (isNearLimit) return '[&>div]:bg-orange-400';
    return '[&>div]:bg-blue-500';
  };

  // Calculate breakdown percentages for visual bar
  const breakdownData = breakdown
    ? [
        { key: 'attachments', label: 'Adjuntos', value: breakdown.attachments, color: 'bg-blue-500' },
        { key: 'avatars', label: 'Avatares', value: breakdown.avatars, color: 'bg-purple-500' },
        { key: 'exports', label: 'Exportaciones', value: breakdown.exports, color: 'bg-green-500' },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              isCritical ? 'bg-red-100' : isNearLimit ? 'bg-orange-100' : 'bg-blue-100'
            }`}>
              <HardDrive className={`h-5 w-5 ${
                isCritical ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-blue-600'
              }`} />
            </div>
            <div>
              <CardTitle className="text-lg">Uso de Almacenamiento</CardTitle>
              <CardDescription>
                {usedGB.toFixed(2)} GB de {limitGB} GB utilizados
              </CardDescription>
            </div>
          </div>
          {isNearLimit && (
            <Button onClick={onUpgrade} className="gap-2" variant={isCritical ? 'destructive' : 'default'}>
              <TrendingUp className="h-4 w-4" />
              Ampliar Almacenamiento
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Espacio utilizado</span>
            <span className={`font-semibold ${isCritical ? 'text-red-600' : isNearLimit ? 'text-orange-600' : ''}`}>
              {percentage.toFixed(1)}%
            </span>
          </div>
          <Progress value={percentage} className={`h-3 ${getBarColor()}`} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{remainingGB.toFixed(2)} GB disponibles</span>
            {isNearLimit && (
              <span className={`flex items-center gap-1 ${isCritical ? 'text-red-600' : 'text-orange-600'}`}>
                <AlertTriangle className="h-3 w-3" />
                {isCritical ? 'Almacenamiento casi lleno' : 'Alto uso de almacenamiento'}
              </span>
            )}
          </div>
        </div>

        {/* Breakdown */}
        {breakdown && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground">DESGLOSE POR CATEGORÍA</h4>

            {/* Visual stacked bar */}
            <div className="flex h-4 rounded-full overflow-hidden bg-muted" role="img" aria-label="Desglose de almacenamiento">
              {breakdownData
                .filter((d) => d.value > 0)
                .map((d) => {
                  const pct = limitGB > 0 ? (d.value / limitGB) * 100 : 0;
                  return (
                    <div
                      key={d.key}
                      className={`${d.color} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${d.label}: ${d.value.toFixed(2)} GB`}
                    />
                  );
                })}
            </div>

            {/* Legend cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {breakdownData.map((d) => {
                const pct = limitGB > 0 ? (d.value / limitGB) * 100 : 0;
                return (
                  <div key={d.key} className="text-center p-3 rounded-lg border bg-card">
                    <div
                      className={`inline-block h-3 w-3 rounded-full ${d.color} mb-2`}
                    />
                    <p className="text-lg font-bold">{d.value.toFixed(2)} GB</p>
                    <p className="text-xs text-muted-foreground">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <FolderOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">No se encontraron archivos</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        No hay archivos que coincidan con tus filtros. Intenta con otros criterios de búsqueda.
      </p>
    </div>
  );
}

function FileRow({
  file,
  onDelete,
}: {
  file: StorageFile;
  onDelete: (file: StorageFile) => void;
}) {
  const catConfig = getCategoryConfig(file.category);
  const isLargeFile = file.fileSize > 10 * 1024 * 1024; // > 10MB

  return (
    <TableRow className="group">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted flex-shrink-0">
            {catConfig.icon}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate max-w-[300px]" title={file.fileName}>
              {file.fileName}
            </p>
            {file.relatedTo && (
              <p className="text-xs text-muted-foreground truncate">
                {file.relatedTo.type === 'patient' ? 'Paciente' : 
                 file.relatedTo.type === 'appointment' ? 'Cita' : 'Nota clínica'}
                {file.relatedTo.name ? `: ${file.relatedTo.name}` : ''}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`${catConfig.bgColor} ${catConfig.color} border gap-1`}>
          {catConfig.icon}
          {catConfig.label}
        </Badge>
      </TableCell>
      <TableCell>
        <span className={`text-sm ${isLargeFile ? 'text-orange-600 font-semibold' : ''}`}>
          {formatFileSize(file.fileSize)}
        </span>
        {isLargeFile && (
          <AlertTriangle className="inline-block h-3 w-3 ml-1 text-orange-500" />
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDateFull(file.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        {file.url ? (
          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(file.url, '_blank')}
              title="Descargar"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(file)}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : file.relatedTo?.type === 'patient' ? (
          // Clinical files are opened and removed in the patient record, where it is audited.
          <a
            href={`/patients/${file.relatedTo.id}?tab=files`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Ver en la ficha
          </a>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

// ==========================================
// Main Page
// ==========================================

function StorageManagementPageContent() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'size' | 'date'>('size');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [fileToDelete, setFileToDelete] = useState<StorageFile | null>(null);

  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: usage, isLoading: usageLoading } = useUsageMetrics();
  const { data: breakdown, isLoading: breakdownLoading } = useStorageBreakdown();
  const { data: files, isLoading: filesLoading } = useStorageFiles({
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    sortBy,
  });
  const deleteFileMutation = useDeleteFile();

  // Parse file list from response
  const fileList: StorageFile[] = useMemo(() => {
    if (!files) return [];
    if (Array.isArray(files)) return files;
    return (files as { data?: StorageFile[] })?.data ?? [];
  }, [files]);

  // Filter and sort files locally
  const filteredFiles = useMemo(() => {
    let result = fileList.filter(
      (file) =>
        file.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      const aVal = sortBy === 'size' ? a.fileSize : new Date(a.createdAt).getTime();
      const bVal = sortBy === 'size' ? b.fileSize : new Date(b.createdAt).getTime();
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [fileList, searchQuery, sortBy, sortOrder]);
  const pagination = usePagination(filteredFiles, {
    resetKey: `${searchQuery}|${categoryFilter}|${sortBy}|${sortOrder}`,
  });

  // Stats
  const totalFiles = fileList.length;
  const totalSize = fileList.reduce((acc, f) => acc + f.fileSize, 0);
  const largeFiles = fileList.filter((f) => f.fileSize > 10 * 1024 * 1024).length;

  const handleDelete = async () => {
    if (!fileToDelete) return;
    await deleteFileMutation.mutateAsync(fileToDelete.id);
    setFileToDelete(null);
  };

  const handleUpgrade = () => {
    router.push(`${ROUTES.ADMIN_SUBSCRIPTION}?action=upgrade&reason=storage`);
  };

  const isLoadingOverview = subLoading || usageLoading;

  // Loading state for entire page
  if (isLoadingOverview) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <SkeletonCard />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTable />
      </div>
    );
  }

  if (!subscription && !usage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Almacenamiento</h1>
          <p className="text-muted-foreground mt-1">Administra tus archivos y documentos</p>
        </div>
        <Alert
          variant="destructive"
          title="Error al cargar datos"
          description="No se pudieron cargar los datos de suscripción y uso. Recarga la página o intenta más tarde."
        />
      </div>
    );
  }

  const usedGB = usage?.storage?.usedGB ?? 0;
  const limitGB = subscription?.plan?.limits?.storageGB ?? usage?.storage?.limitGB ?? 0;
  const remainingGB = usage ? getRemainingStorageGB(usage) : 0;
  const percentage = limitGB > 0 ? (usedGB / limitGB) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Almacenamiento</h1>
          <p className="text-muted-foreground mt-1">
            Administra tus archivos y documentos
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => router.push(ROUTES.ADMIN_SUBSCRIPTION)}
        >
          <CreditCard className="h-4 w-4" />
          Ver Suscripción
        </Button>
      </div>

      {/* Alert if near limit */}
      {percentage >= 90 && (
        <Alert
          variant="destructive"
          title="Espacio de almacenamiento casi lleno"
          description={`Has utilizado ${usedGB.toFixed(2)} GB de ${limitGB} GB. Elimina archivos o actualiza tu plan para obtener más espacio.`}
        />
      )}

      {/* Storage Overview */}
      <StorageOverviewCard
        usedGB={usedGB}
        limitGB={limitGB}
        remainingGB={remainingGB}
        breakdown={breakdown ?? usage?.storage?.breakdown ?? null}
        onUpgrade={handleUpgrade}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{totalFiles}</p>
            <p className="text-xs text-muted-foreground mt-1">Total archivos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{formatFileSize(totalSize)}</p>
            <p className="text-xs text-muted-foreground mt-1">Tamaño total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-orange-600">{largeFiles}</p>
            <p className="text-xs text-muted-foreground mt-1">Archivos grandes (+10MB)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className={`text-2xl font-bold ${percentage >= 80 ? 'text-orange-600' : 'text-green-600'}`}>
              {remainingGB.toFixed(2)} GB
            </p>
            <p className="text-xs text-muted-foreground mt-1">Espacio disponible</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar archivos por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value="attachment">Adjuntos</SelectItem>
                <SelectItem value="avatar">Avatares</SelectItem>
                <SelectItem value="export">Exportaciones</SelectItem>
              </SelectContent>
            </Select>

            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(v) => {
              const [s, o] = v.split('-') as ['size' | 'date', 'asc' | 'desc'];
              setSortBy(s);
              setSortOrder(o);
            }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="size-desc">Mayor tamaño primero</SelectItem>
                <SelectItem value="size-asc">Menor tamaño primero</SelectItem>
                <SelectItem value="date-desc">Más recientes</SelectItem>
                <SelectItem value="date-asc">Más antiguos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Archivos
              {filteredFiles.length > 0 && (
                <span className="text-muted-foreground font-normal text-sm ml-2">
                  ({filteredFiles.length}{searchQuery || categoryFilter !== 'all' ? ` de ${totalFiles}` : ''})
                </span>
              )}
            </CardTitle>
            {filteredFiles.length > 0 && largeFiles > 0 && (
              <div className="flex items-center gap-1 text-xs text-orange-600">
                <Info className="h-3 w-3" />
                <span>{largeFiles} archivo{largeFiles > 1 ? 's' : ''} grande{largeFiles > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filesLoading ? (
            <SkeletonTable />
          ) : filteredFiles.length === 0 ? (
            <EmptyState />
          ) : (
            <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[250px]">Archivo</TableHead>
                    <TableHead className="w-[150px]">Categoría</TableHead>
                    <TableHead className="w-[120px]">Tamaño</TableHead>
                    <TableHead className="w-[180px]">Fecha</TableHead>
                    <TableHead className="w-[100px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((file) => (
                    <FileRow key={file.id} file={file} onDelete={setFileToDelete} />
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              className="mt-4"
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
            />
            </>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground">CONSEJOS PARA GESTIONAR TU ALMACENAMIENTO</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex gap-3">
              <Trash2 className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Elimina archivos innecesarios</p>
                <p className="text-xs text-muted-foreground">
                  Revisa exportaciones antiguas y avatares que ya no uses.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <ImageIcon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Optimiza imágenes</p>
                <p className="text-xs text-muted-foreground">
                  Comprime imágenes antes de subirlas para ahorrar espacio.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Actualiza tu plan</p>
                <p className="text-xs text-muted-foreground">
                  Obtén más almacenamiento al cambiar a un plan superior.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Estás a punto de eliminar <strong>{fileToDelete?.fileName}</strong>.
                </p>
                {fileToDelete && (
                  <div className="rounded-lg border p-3 bg-muted/50 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tamaño:</span>
                      <span className="font-medium">{formatFileSize(fileToDelete.fileSize)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Categoría:</span>
                      <span className="font-medium">{getCategoryConfig(fileToDelete.category).label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subido:</span>
                      <span className="font-medium">{formatDate(fileToDelete.createdAt)}</span>
                    </div>
                  </div>
                )}
                <p className="text-destructive text-sm font-medium">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFileMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteFileMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFileMutation.isPending ? 'Eliminando...' : 'Eliminar Archivo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function StorageManagementPage() {
  const user = useAuthStore((state) => state.user);
  const canManage = useCanManageAccount();
  if (!user) return null;
  // The menu entry is hidden for other roles; this covers direct navigation.
  if (!canManage) return <RestrictedAccess />;
  return (
    <SectionGate section="core.patients.files">
      <StorageManagementPageContent />
    </SectionGate>
  );
}
