'use client';

import { useState, type ReactNode } from 'react';
import { Plus, StickyNote, Trash2 } from 'lucide-react';
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
import { FeatureLockedNotice, isFeatureLockedError } from '@/features/subscription/feature-locked-notice';
import {
  useCreateClinicalNote,
  useDeleteClinicalNote,
  usePatientClinicalNotes,
} from '@/hooks/useClinicalNotes';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { ClinicalNote } from '@/types';
import type { Encounter } from '@/types/clinical';

const TITLE = 'Notas clínicas';

/**
 * The only place where clinical notes are written: inside the attention in course, so each note
 * belongs to it and is signed with it when it closes. The clinical history only reads them.
 * Without an open attention it says how to start one.
 */
export function EncounterNotes({
  patientId,
  openEncounter,
  startHint,
}: {
  patientId: string;
  openEncounter?: Encounter;
  /** How to start an attention in this clinic (the panel above, or the treatments tab). */
  startHint: ReactNode;
}) {
  if (!openEncounter) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" aria-hidden="true" />
            {TITLE}
          </CardTitle>
          <CardDescription>
            Las notas se escriben dentro de una atención abierta. {startHint}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return <OpenEncounterNotes patientId={patientId} encounter={openEncounter} />;
}

function OpenEncounterNotes({ patientId, encounter }: { patientId: string; encounter: Encounter }) {
  const userId = useAuthStore((state) => state.user?.id);
  const { data: notes = [], isLoading, error } = usePatientClinicalNotes(patientId);
  const createNote = useCreateClinicalNote();
  const deleteNote = useDeleteClinicalNote();
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ diagnosis: '', content: '' });
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const ofThisEncounter = notes.filter((note: ClinicalNote) => note.encounterId === encounter.id);

  if (isFeatureLockedError(error)) {
    return <FeatureLockedNotice featureName="El módulo de notas clínicas" />;
  }

  const closeWriting = () => {
    setWriting(false);
    setForm({ diagnosis: '', content: '' });
  };
  const closeDelete = () => {
    setDeleteNoteId(null);
    setDeleteReason('');
  };

  const handleCreate = () => {
    createNote.mutate(
      {
        patientId,
        encounterId: encounter.id,
        content: form.content.trim(),
        diagnosis: form.diagnosis.trim() || undefined,
      },
      { onSuccess: closeWriting },
    );
  };
  const handleDelete = () => {
    if (!deleteNoteId || !deleteReason.trim()) return;
    deleteNote.mutate(
      { noteId: deleteNoteId, patientId, reason: deleteReason.trim() },
      { onSuccess: closeDelete },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" aria-hidden="true" />
              {TITLE}
            </CardTitle>
            <CardDescription>
              Quedan dentro de esta atención y se firman al cerrarla; después se leen en la Historia
              clínica.
            </CardDescription>
          </div>
          <Button onClick={() => setWriting(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva nota
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : ofThisEncounter.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay notas en esta atención.</p>
        ) : (
          <ul className="divide-y rounded-md border border-input">
            {ofThisEncounter.map((note) => (
              <li key={note.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{note.diagnosis || 'Nota clínica'}</p>
                  <p className="whitespace-pre-wrap">{note.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      note.psychologist && `${note.psychologist.firstName} ${note.psychologist.lastName}`,
                      formatDate(note.sessionDate ?? note.createdAt, 'dd/MM/yyyy HH:mm'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {/* Only its author removes a note, and only while the attention is open. */}
                {note.psychologistId === userId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar nota clínica"
                    onClick={() => setDeleteNoteId(note.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={writing} onOpenChange={(open) => !open && closeWriting()}>
        <DialogContent
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-dialog-title"
          className="max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle id="note-dialog-title">Nueva nota clínica</DialogTitle>
            <DialogDescription>
              Las notas clínicas son confidenciales y solo son visibles para profesionales.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-title">Diagnóstico (opcional)</Label>
              <Input
                id="note-title"
                value={form.diagnosis}
                onChange={(event) => setForm({ ...form, diagnosis: event.target.value })}
                placeholder="Ej: Trastorno de ansiedad generalizada"
              />
            </div>
            <div>
              <Label htmlFor="note-content">Contenido</Label>
              <Textarea
                id="note-content"
                value={form.content}
                onChange={(event) => setForm({ ...form, content: event.target.value })}
                placeholder="Escribe las notas de la sesión..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeWriting}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.content.trim() || createNote.isPending}
              loading={createNote.isPending}
            >
              Guardar nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && closeDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar nota clínica?</AlertDialogTitle>
            <AlertDialogDescription>
              La nota dejará de mostrarse en la historia clínica. Se conserva en el registro de
              auditoría junto con el motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label htmlFor="note-delete-reason">Motivo de la eliminación</Label>
            <Textarea
              id="note-delete-reason"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Ej: Nota registrada en el paciente equivocado"
              maxLength={500}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Keep the dialog open until the API confirms.
                event.preventDefault();
                handleDelete();
              }}
              disabled={!deleteReason.trim() || deleteNote.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
