'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useClinicProfessionals } from '@/hooks/useBranches';
import {
  useAddClinicalResult,
  useCancelClinicalOrder,
  useCloseClinicalFollowUp,
  useCollectSample,
  useCommunicateClinicalResult,
  useCompleteClinicalOrder,
  useReviewClinicalResult,
  useSendToLab,
} from '@/hooks/useClinicalOrders';
import { useDownloadPatientFile, usePatientFiles } from '@/hooks/usePatientFiles';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import {
  CONTACT_CHANNEL_LABELS,
  REVIEW_DECISION_LABELS,
  type ClinicalFollowUp,
  type ClinicalOrderStatus,
  type ClinicalResult,
  type PatientContactChannel,
  type ResultReviewDecision,
} from '@/types/clinical-orders';

/** What an action needs from the order it acts on. */
export interface OrderRef {
  id: string;
  patientId: string;
  studyName: string;
  status: ClinicalOrderStatus;
  version: number;
  provider?: string | null;
  externalReference?: string | null;
  /** The last version of the result: what a review or a communication is about. */
  currentResult?: (Pick<ClinicalResult, 'id' | 'communicatedAt'> & Partial<ClinicalResult>) | null;
}

/**
 * The report a professional reviews or tells the patient about, as the laboratory issued it, with
 * its file to open. A decision is never recorded on a result the dialog did not show.
 */
function ResultSummary({ patientId, result }: { patientId: string; result: NonNullable<OrderRef['currentResult']> }) {
  const download = useDownloadPatientFile(patientId);
  return (
    <section aria-label="Resultado" className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
      <p className="font-medium">
        Resultado{result.version && result.version > 1 ? ` (versión ${result.version})` : ''}
        {result.receivedAt && ` · recibido el ${formatDate(result.receivedAt)}`}
        {result.studyDate && ` · estudio del ${formatDate(result.studyDate)}`}
        {result.issuedBy && ` · ${result.issuedBy}`}
      </p>
      {result.content ? (
        <p className="max-h-60 overflow-y-auto whitespace-pre-wrap">{result.content}</p>
      ) : (
        <p className="text-muted-foreground">Sin texto transcrito: el informe está en el archivo.</p>
      )}
      {result.file && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={download.isPending}
          onClick={() => download.mutate(result.file!)}
        >
          <Download className="mr-1 h-4 w-4" /> Abrir {result.file.fileName}
        </Button>
      )}
    </section>
  );
}

export type OrderAction =
  | 'sample'
  | 'send'
  | 'result'
  | 'review'
  | 'communicate'
  | 'complete'
  | 'cancel';

/** The steps each status offers, in the order a professional usually takes them. */
export function availableActions(order: OrderRef): OrderAction[] {
  switch (order.status) {
    case 'ORDERED':
      return ['sample', 'send', 'result', 'cancel'];
    case 'SAMPLE_COLLECTED':
      return ['send', 'result', 'cancel'];
    case 'SENT_TO_LAB':
      return ['result', 'cancel'];
    case 'PENDING_REVIEW':
      return ['review', 'result'];
    case 'REVIEWED':
      return ['communicate', 'complete', 'result'];
    case 'PATIENT_CONTACTED':
      return ['complete', 'result'];
    default:
      return [];
  }
}

export const ACTION_LABELS: Record<OrderAction, string> = {
  sample: 'Registrar toma de muestra',
  send: 'Registrar envío',
  result: 'Registrar resultado',
  review: 'Revisar resultado',
  communicate: 'Registrar comunicación',
  complete: 'Cerrar orden',
  cancel: 'Anular',
};

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const today = () => new Date().toISOString().slice(0, 10);
/**
 * A date input value (yyyy-mm-dd) as noon UTC of that day: shown in any timezone from UTC-11 to
 * UTC+11 it stays on the day the user picked.
 */
const dayToIso = (day: string) => new Date(`${day}T12:00:00.000Z`).toISOString();

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

/** Who will do a follow-up: a professional of the clinic, by default the person writing it. */
export function FollowUpFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: { title: string; dueDate: string; assignedToId: string };
  onChange: (value: { title: string; dueDate: string; assignedToId: string }) => void;
}) {
  const me = useAuthStore((state) => state.user);
  const { data: professionals = [] } = useClinicProfessionals();
  const options = professionals.some((user) => user.id === me?.id) || !me
    ? professionals
    : [me, ...professionals];
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Seguimiento</p>
      <Field id={`${idPrefix}-title`} label="Qué hay que hacer" required>
        <Input
          id={`${idPrefix}-title`}
          value={value.title}
          maxLength={300}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${idPrefix}-due`} label="Fecha objetivo" required>
          <Input
            id={`${idPrefix}-due`}
            type="date"
            min={today()}
            value={value.dueDate}
            onChange={(event) => onChange({ ...value, dueDate: event.target.value })}
          />
        </Field>
        <Field id={`${idPrefix}-assignee`} label="Responsable">
          <select
            id={`${idPrefix}-assignee`}
            className={selectClass}
            value={value.assignedToId}
            onChange={(event) => onChange({ ...value, assignedToId: event.target.value })}
          >
            {options.map((user) => (
              <option key={user.id} value={user.id}>
                {user.id === me?.id ? 'Yo' : `${user.firstName} ${user.lastName}`}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

/**
 * The dialog of one step of an order. `order` is the current one, read from the list it came
 * from: when someone else moves the order meanwhile (the API answers a version conflict and the
 * list reloads), the dialog takes the new version and keeps what was typed, or says the step no
 * longer applies. `gone` says the order left the list it was opened from.
 */
export function OrderActionDialog({
  order,
  action,
  onClose,
  gone = false,
}: {
  order: OrderRef;
  action: OrderAction;
  onClose: () => void;
  gone?: boolean;
}) {
  // What the user opened the dialog on: a later change to it is shown, never silently applied.
  const [opened] = useState(() => ({ version: order.version, resultId: order.currentResult?.id }));
  const me = useAuthStore((state) => state.user);
  const patientId = order.patientId;
  const sample = useCollectSample(patientId);
  const send = useSendToLab(patientId);
  const result = useAddClinicalResult(patientId);
  const review = useReviewClinicalResult(patientId);
  const communicate = useCommunicateClinicalResult(patientId);
  const complete = useCompleteClinicalOrder(patientId);
  const cancel = useCancelClinicalOrder(patientId);
  const { data: files = [] } = usePatientFiles(action === 'result' ? patientId : '');

  const [text, setText] = useState('');
  const [provider, setProvider] = useState(order.provider ?? '');
  const [reference, setReference] = useState(order.externalReference ?? '');
  const [fileId, setFileId] = useState('');
  const [issuedBy, setIssuedBy] = useState('');
  const [studyDate, setStudyDate] = useState('');
  const [decision, setDecision] = useState<ResultReviewDecision>('NO_FURTHER_ACTION');
  const [appointmentNeeded, setAppointmentNeeded] = useState(false);
  const [followUp, setFollowUp] = useState({ title: '', dueDate: '', assignedToId: me?.id ?? '' });
  const [channel, setChannel] = useState<PatientContactChannel>('IN_PERSON');
  const [endStatus, setEndStatus] = useState<'CANCELLED' | 'NOT_PERFORMED'>('CANCELLED');

  const resultId = order.currentResult?.id;
  const aboutResult = action === 'review' || action === 'communicate';
  const stale =
    gone ||
    !availableActions(order).includes(action) ||
    (aboutResult && resultId !== opened.resultId);
  const changed = !stale && order.version !== opened.version;
  const needsFollowUp = decision !== 'NO_FURTHER_ACTION';
  // Closing without a recorded contact with the patient needs the reason.
  const completionNeedsNote = action === 'complete' && order.status !== 'PATIENT_CONTACTED';
  const done = { onSuccess: onClose };
  const version = order.version;

  const pending = [sample, send, result, review, communicate, complete, cancel].some(
    (mutation) => mutation.isPending,
  );

  const invalid = (() => {
    switch (action) {
      case 'result':
        return !text.trim() && !fileId;
      case 'review':
        return !text.trim() || (needsFollowUp && (!followUp.title.trim() || !followUp.dueDate));
      case 'complete':
        return completionNeedsNote && !text.trim();
      case 'cancel':
        return !text.trim();
      default:
        return false;
    }
  })();

  const submit = () => {
    const note = text.trim() || undefined;
    switch (action) {
      case 'sample':
        return sample.mutate({ orderId: order.id, version, notes: note }, done);
      case 'send':
        return send.mutate(
          {
            orderId: order.id,
            version,
            provider: provider.trim() || undefined,
            externalReference: reference.trim() || undefined,
          },
          done,
        );
      case 'result':
        return result.mutate(
          {
            orderId: order.id,
            version,
            content: note,
            fileId: fileId || undefined,
            issuedBy: issuedBy.trim() || undefined,
            studyDate: studyDate ? dayToIso(studyDate) : undefined,
          },
          done,
        );
      case 'review':
        return review.mutate(
          {
            resultId: resultId!,
            decision,
            note: text.trim(),
            appointmentNeeded,
            followUp: needsFollowUp
              ? {
                  title: followUp.title.trim(),
                  dueDate: dayToIso(followUp.dueDate),
                  assignedToId: followUp.assignedToId || undefined,
                }
              : undefined,
          },
          done,
        );
      case 'communicate':
        return communicate.mutate({ resultId: resultId!, channel, note }, done);
      case 'complete':
        return complete.mutate({ orderId: order.id, version, note }, done);
      case 'cancel':
        return cancel.mutate({ orderId: order.id, version, status: endStatus, reason: text.trim() }, done);
    }
  };

  const textLabel: Record<OrderAction, string> = {
    sample: 'Observaciones de la muestra',
    send: '',
    result: 'Informe del resultado',
    review: 'Conducta',
    communicate: 'Qué se le informó',
    complete: completionNeedsNote ? 'Por qué se cierra sin comunicación registrada' : 'Nota de cierre',
    cancel: 'Motivo',
  };
  const descriptions: Partial<Record<OrderAction, string>> = {
    result:
      'Transcribe el informe como lo emitió el laboratorio o elige el archivo que subiste en «Archivos». Queda pendiente de revisión; registrarlo no informa al paciente.',
    review: 'La revisión queda firmada con tu nombre. El sistema no interpreta resultados: la decisión es tuya.',
    communicate: 'Registra cómo y cuándo se informó al paciente del resultado revisado.',
    complete: 'Una orden solo se cierra con su último resultado revisado y sin seguimientos abiertos.',
    cancel: 'Solo se anula una orden sin resultado.',
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[action]}</DialogTitle>
          <DialogDescription>
            {order.studyName}
            {descriptions[action] ? ` — ${descriptions[action]}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {stale && (
            <Alert variant="warning">
              La orden cambió mientras tenías abierto este diálogo y este paso ya no aplica. Cierra y revisa su estado actual.
            </Alert>
          )}
          {changed && (
            <Alert variant="warning">
              Alguien más actualizó la orden mientras la tenías abierta. Revisa su estado; lo que escribiste se conserva y se
              enviará sobre la versión actual.
            </Alert>
          )}
          {aboutResult && order.currentResult && !stale && (
            <ResultSummary patientId={patientId} result={order.currentResult} />
          )}
          {action === 'send' && (
            <>
              <Field id="order-provider" label="Laboratorio o proveedor">
                <Input id="order-provider" value={provider} maxLength={200} onChange={(e) => setProvider(e.target.value)} />
              </Field>
              <Field id="order-reference" label="Folio o número de orden del laboratorio">
                <Input id="order-reference" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
              </Field>
            </>
          )}

          {action === 'result' && (
            <>
              <Field id="result-file" label="Archivo del informe">
                <select id="result-file" className={selectClass} value={fileId} onChange={(e) => setFileId(e.target.value)}>
                  <option value="">Sin archivo</option>
                  {files.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.fileName}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="result-issuer" label="Emitido por">
                  <Input id="result-issuer" value={issuedBy} maxLength={200} onChange={(e) => setIssuedBy(e.target.value)} />
                </Field>
                <Field id="result-study-date" label="Fecha del estudio">
                  <Input id="result-study-date" type="date" max={today()} value={studyDate} onChange={(e) => setStudyDate(e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {action === 'review' && (
            <>
              <Field id="review-decision" label="Decisión" required>
                <select
                  id="review-decision"
                  className={selectClass}
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as ResultReviewDecision)}
                >
                  {(Object.keys(REVIEW_DECISION_LABELS) as ResultReviewDecision[]).map((key) => (
                    <option key={key} value={key}>
                      {REVIEW_DECISION_LABELS[key]}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={appointmentNeeded}
                  onChange={(e) => setAppointmentNeeded(e.target.checked)}
                />
                Requiere una cita adicional
              </label>
            </>
          )}

          {action === 'communicate' && (
            <Field id="communication-channel" label="Medio" required>
              <select
                id="communication-channel"
                className={selectClass}
                value={channel}
                onChange={(e) => setChannel(e.target.value as PatientContactChannel)}
              >
                {(Object.keys(CONTACT_CHANNEL_LABELS) as PatientContactChannel[]).map((key) => (
                  <option key={key} value={key}>
                    {CONTACT_CHANNEL_LABELS[key]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {action === 'cancel' && (
            <Field id="cancel-status" label="Cómo termina" required>
              <select
                id="cancel-status"
                className={selectClass}
                value={endStatus}
                onChange={(e) => setEndStatus(e.target.value as 'CANCELLED' | 'NOT_PERFORMED')}
              >
                <option value="CANCELLED">Anulada</option>
                <option value="NOT_PERFORMED">No realizada</option>
              </select>
            </Field>
          )}

          {action !== 'send' && (
            <Field
              id="order-action-text"
              label={textLabel[action]}
              required={action === 'review' || action === 'cancel' || completionNeedsNote}
            >
              <Textarea
                id="order-action-text"
                rows={action === 'result' ? 6 : 3}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
          )}

          {action === 'review' && needsFollowUp && (
            <FollowUpFields idPrefix="review-follow-up" value={followUp} onChange={setFollowUp} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || invalid || stale}>
            {ACTION_LABELS[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Closes a follow-up as done or cancelled, always saying what was done. */
export function CloseFollowUpDialog({
  followUp,
  onClose,
  gone = false,
}: {
  /** The follow-up as its list shows it now: after a version conflict the list reloads. */
  followUp: Pick<ClinicalFollowUp, 'id' | 'patientId' | 'title' | 'version'> & {
    status?: ClinicalFollowUp['status'];
  };
  onClose: () => void;
  /** It left the list the dialog was opened from. */
  gone?: boolean;
}) {
  const close = useCloseClinicalFollowUp(followUp.patientId);
  const [status, setStatus] = useState<'DONE' | 'CANCELLED'>('DONE');
  const [note, setNote] = useState('');
  const [openedVersion] = useState(followUp.version);
  const stale = gone || (followUp.status !== undefined && followUp.status !== 'OPEN');
  const changed = !stale && followUp.version !== openedVersion;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar seguimiento</DialogTitle>
          <DialogDescription>{followUp.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {stale && (
            <Alert variant="warning">Alguien más cerró este seguimiento mientras tenías abierto el diálogo.</Alert>
          )}
          {changed && (
            <Alert variant="warning">
              Alguien más cambió este seguimiento. Revisa su fecha y responsable; lo que escribiste se conserva.
            </Alert>
          )}
          <Field id="follow-up-status" label="Resultado" required>
            <select
              id="follow-up-status"
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as 'DONE' | 'CANCELLED')}
            >
              <option value="DONE">Realizado</option>
              <option value="CANCELLED">Ya no es necesario</option>
            </select>
          </Field>
          <Field id="follow-up-note" label={status === 'DONE' ? 'Qué se hizo' : 'Por qué ya no es necesario'} required>
            <Textarea id="follow-up-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={close.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={close.isPending || !note.trim() || stale}
            onClick={() =>
              close.mutate(
                { followUpId: followUp.id, version: followUp.version, status, note: note.trim() },
                { onSuccess: onClose },
              )
            }
          >
            Cerrar seguimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
