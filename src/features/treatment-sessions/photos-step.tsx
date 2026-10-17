'use client';

import { useId, useState } from 'react';
import { Camera } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useSessionCommand } from '@/hooks/useTreatmentSessions';
import type { ApiError } from '@/types';
import type {
  SessionCommandName,
  SessionMediaPhase,
  TreatmentSessionDetail,
  TreatmentSessionStatus,
} from '@/types/treatments';
import { formatSignedAt } from './consent-step';

type PhotoPhase = Extract<SessionMediaPhase, 'BEFORE' | 'AFTER'>;

const PHASES: Record<
  PhotoPhase,
  { command: SessionCommandName; noun: string; empty: string; notYet: string; tooLate: string }
> = {
  BEFORE: {
    command: 'UPLOAD_BEFORE',
    noun: 'antes',
    empty: 'Aún no hay fotos de antes.',
    notYet: 'Las fotos de antes se habilitan cuando la ficha y el consentimiento estén listos.',
    tooLate: 'Esta atención ya no admite fotos de antes.',
  },
  AFTER: {
    command: 'UPLOAD_AFTER',
    noun: 'después',
    empty: 'Aún no hay fotos de después.',
    notYet: 'Las fotos de después se habilitan cuando se inicia el procedimiento.',
    tooLate: 'Esta atención ya no admite fotos de después.',
  },
};

const BEFORE_START: TreatmentSessionStatus[] = ['INTAKE_IN_PROGRESS', 'READY_FOR_CONSENT', 'CONSENTED'];

/** Why the phase does not take photos right now, from the status the API reports. */
function disabledReason(session: TreatmentSessionDetail, phase: PhotoPhase): string {
  const texts = PHASES[phase];
  return BEFORE_START.includes(session.status) ? texts.notYet : texts.tooLate;
}

export interface PhotosStepProps {
  session: TreatmentSessionDetail;
  phase: PhotoPhase;
  /** For someone other than the session's professional: the photos are only listed. */
  readOnly?: boolean;
}

/**
 * Photos of one phase of the session. The list is what the session detail reports; an upload adds
 * nothing to it until the server confirms and the detail is read again. The images themselves are
 * not fetched here.
 */
export function PhotosStep({ session, phase, readOnly = false }: PhotosStepProps) {
  const { uploadMedia } = useSessionCommand(session.id);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();

  const texts = PHASES[phase];
  const minimum =
    phase === 'BEFORE' ? session.policy.photos.minimumBefore : session.policy.photos.minimumAfter;
  const photos = session.media.filter((media) => media.phase === phase);
  const allowed = session.allowedCommands.includes(texts.command);
  const uploading = uploadMedia.isPending;

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || uploading) return;
    setError(null);
    try {
      await uploadMedia.mutateAsync({ file, phase });
    } catch (failure) {
      setError((failure as ApiError | undefined)?.message || 'No se pudo guardar la foto.');
    } finally {
      // The same file can be chosen again after a failure.
      input.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Camera className="h-5 w-5 text-muted-foreground" aria-hidden />
        {minimum > 0 ? (
          <Badge variant={photos.length >= minimum ? 'success' : 'warning'} className="text-sm">
            {photos.length} de {minimum} fotos
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-sm">
            Opcional
          </Badge>
        )}
      </div>

      {!readOnly && (
        <div className="space-y-2">
          <Label htmlFor={inputId}>Agregar foto de {texts.noun}</Label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            disabled={!allowed || uploading}
            aria-describedby={allowed ? undefined : hintId}
            onChange={handleChange}
            className="block min-h-11 w-full cursor-pointer text-sm file:mr-4 file:h-11 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-4 file:text-sm file:font-medium file:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:file:cursor-not-allowed"
          />
          {!allowed && (
            <p id={hintId} className="text-sm text-muted-foreground">
              {disabledReason(session, phase)}
            </p>
          )}
          {uploading && (
            <p role="status" className="text-sm text-muted-foreground">
              Guardando la foto…
            </p>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive" title="No se guardó la foto">
          {error}
        </Alert>
      )}

      {photos.length > 0 ? (
        <ul aria-label={`Fotos de ${texts.noun}`} className="space-y-2">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-input px-3 py-2 text-sm"
            >
              <span className="min-w-0 break-all font-medium">{photo.fileName}</span>
              <span className="text-muted-foreground">
                {formatSignedAt(photo.createdAt, session.timezone)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{texts.empty}</p>
      )}
    </div>
  );
}
