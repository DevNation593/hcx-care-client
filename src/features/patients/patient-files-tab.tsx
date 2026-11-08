'use client';

import { useRef, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePatientEncounters } from '@/hooks/useEncounters';
import {
  useDownloadPatientFile,
  usePatientFiles,
  useRemovePatientFile,
  useUploadPatientFile,
} from '@/hooks/usePatientFiles';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import {
  PATIENT_FILE_CATEGORY_LABELS,
  type PatientFile,
  type PatientFileCategory,
} from '@/types/clinical';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The problem with a chosen file, or null when it can be uploaded. */
export function fileProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Solo se aceptan archivos PDF, JPG o PNG.';
  if (file.size > MAX_BYTES) return 'El archivo supera los 10 MB.';
  if (file.size === 0) return 'El archivo está vacío.';
  return null;
}

/** Clinical files of the patient: results, images, signed consents. */
export function PatientFilesTab({ patientId }: { patientId: string }) {
  const userId = useAuthStore((state) => state.user?.id);
  const filesQuery = usePatientFiles(patientId);
  const { data: encounters = [] } = usePatientEncounters(patientId);
  const upload = useUploadPatientFile(patientId);
  const download = useDownloadPatientFile(patientId);
  const [removing, setRemoving] = useState<PatientFile | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<PatientFileCategory>('EXAMEN');
  const [description, setDescription] = useState('');
  const problem = file ? fileProblem(file) : null;
  // A file uploaded during an attention belongs to it.
  // A file of a closed encounter is part of its signature: it can no longer be removed.
  const signedFile = (file: PatientFile) =>
    !!file.encounterId &&
    encounters.some((encounter) => encounter.id === file.encounterId && encounter.status === 'CLOSED');
  const openEncounter = encounters.find(
    (encounter) => encounter.status === 'OPEN' && encounter.professionalId === userId,
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || problem || upload.isPending) return;
    try {
      await upload.mutateAsync({
        file,
        category,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(openEncounter ? { encounterId: openEncounter.id } : {}),
      });
      setFile(null);
      setDescription('');
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      // The hook already reported the error; the chosen file stays to retry.
    }
  };

  const files = filesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Subir archivo</CardTitle>
          <CardDescription>
            Resultados, imágenes o documentos firmados en PDF, JPG o PNG, de hasta 10 MB. Se guardan
            cifrados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="patient-file">Archivo</Label>
                <Input
                  id="patient-file"
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? 'patient-file-error' : undefined}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                {problem && (
                  <p id="patient-file-error" className="mt-1 text-sm text-destructive">
                    {problem}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="patient-file-category">Tipo de archivo</Label>
                <select
                  id="patient-file-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as PatientFileCategory)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {(Object.keys(PATIENT_FILE_CATEGORY_LABELS) as PatientFileCategory[]).map((key) => (
                    <option key={key} value={key}>
                      {PATIENT_FILE_CATEGORY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="patient-file-description">Descripción</Label>
              <Input
                id="patient-file-description"
                value={description}
                maxLength={500}
                placeholder="Hemograma del 2 de octubre"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            {openEncounter && (
              <p className="text-sm text-muted-foreground">
                Se guardará dentro de la atención en curso.
              </p>
            )}
            <Button type="submit" disabled={!file || !!problem} loading={upload.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              Subir archivo
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Archivos del paciente</h3>
        {filesQuery.isError ? (
          <Alert variant="destructive" title="No se pudieron cargar los archivos">
            <Button variant="outline" size="sm" className="mt-2" onClick={() => filesQuery.refetch()}>
              Reintentar
            </Button>
          </Alert>
        ) : filesQuery.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : files.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay archivos de este paciente.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {files.map((item) => {
              const Icon = item.mimeType.startsWith('image/') ? ImageIcon : FileText;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-input p-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-all font-medium">{item.fileName}</p>
                        <Badge variant="outline">
                          {PATIENT_FILE_CATEGORY_LABELS[item.category] ?? item.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[
                          formatBytes(item.sizeBytes),
                          formatDate(item.createdAt, 'dd/MM/yyyy'),
                          item.uploadedBy && `${item.uploadedBy.firstName} ${item.uploadedBy.lastName}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {item.description && <p className="text-sm">{item.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={download.isPending}
                      onClick={() => download.mutate(item)}
                      aria-label={`Descargar ${item.fileName}`}
                    >
                      <Download className="mr-1 h-4 w-4" />
                      Descargar
                    </Button>
                    {signedFile(item) ? (
                      <span className="text-xs text-muted-foreground">En una atención firmada</span>
                    ) : item.uploadedById === userId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoving(item)}
                        aria-label={`Eliminar ${item.fileName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {removing && (
        <RemoveFileDialog patientId={patientId} file={removing} onClose={() => setRemoving(null)} />
      )}
    </div>
  );
}

function RemoveFileDialog({
  patientId,
  file,
  onClose,
}: {
  patientId: string;
  file: PatientFile;
  onClose: () => void;
}) {
  const remove = useRemovePatientFile(patientId);
  const [reason, setReason] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || remove.isPending) return;
    try {
      await remove.mutateAsync({ fileId: file.id, reason: reason.trim() });
      onClose();
    } catch {
      // The hook already reported the error; the dialog stays open to retry.
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Eliminar archivo</DialogTitle>
            <DialogDescription>
              «{file.fileName}» dejará de mostrarse en la ficha del paciente. Se conserva para la
              auditoría con el motivo que indiques y sigue contando en el almacenamiento.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="remove-file-reason">
              Motivo<span className="text-destructive"> *</span>
            </Label>
            <Textarea
              id="remove-file-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason.trim()}
              loading={remove.isPending}
            >
              Eliminar archivo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
