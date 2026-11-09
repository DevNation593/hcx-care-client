'use client';

import { useState } from 'react';
import { AlertTriangle, ClipboardCheck, FlaskConical, Plus } from 'lucide-react';
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
import {
  SignaturePasswordField,
  signaturePasswordError,
} from '@/features/patients/signature-password-field';
import {
  useCreateClinicalFollowUp,
  useCreateClinicalOrder,
  usePatientClinicalFollowUps,
  usePatientClinicalOrders,
} from '@/hooks/useClinicalOrders';
import { usePatientEncounters } from '@/hooks/useEncounters';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import {
  CLOSED_ORDER_STATUSES,
  CONTACT_CHANNEL_LABELS,
  FOLLOW_UP_STATUS_LABELS,
  ORDER_PRIORITY_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  REVIEW_DECISION_LABELS,
  type ClinicalFollowUp,
  type ClinicalOrder,
  type ClinicalOrderPriority,
  type ClinicalOrderType,
} from '@/types/clinical-orders';
import {
  ACTION_LABELS,
  availableActions,
  CloseFollowUpDialog,
  FollowUpFields,
  OrderActionDialog,
  type OrderAction,
} from './order-actions';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const person = (value: { firstName: string; lastName: string } | null | undefined) =>
  value ? `${value.firstName} ${value.lastName}` : '';
/**
 * A date input value (yyyy-mm-dd) as noon UTC of that day: shown in any timezone from UTC-11 to
 * UTC+11 it stays on the day the user picked.
 */
const dayToIso = (day: string) => new Date(`${day}T12:00:00.000Z`).toISOString();

/** The badge of an order: what is pending is highlighted, what is closed is muted. */
function StatusBadge({ order }: { order: Pick<ClinicalOrder, 'status'> }) {
  const variant = CLOSED_ORDER_STATUSES.includes(order.status)
    ? 'secondary'
    : order.status === 'PENDING_REVIEW'
      ? 'warning'
      : 'outline';
  return <Badge variant={variant}>{ORDER_STATUS_LABELS[order.status]}</Badge>;
}

function FollowUpItem({
  followUp,
  onClose,
}: {
  followUp: ClinicalFollowUp;
  onClose: (followUp: ClinicalFollowUp) => void;
}) {
  const overdue = followUp.status === 'OPEN' && new Date(followUp.dueDate) < new Date();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <div>
        <p className="font-medium">{followUp.title}</p>
        <p className="text-muted-foreground">
          {followUp.status === 'OPEN' ? 'Para el ' : 'Era para el '}
          {formatDate(followUp.dueDate)}
          {followUp.assignedTo && ` · ${person(followUp.assignedTo)}`}
          {followUp.closureNote && ` · ${followUp.closureNote}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {overdue && <Badge variant="destructive">Vencido</Badge>}
        <Badge variant={followUp.status === 'OPEN' ? 'outline' : 'secondary'}>
          {FOLLOW_UP_STATUS_LABELS[followUp.status]}
        </Badge>
        {followUp.status === 'OPEN' && (
          <Button size="sm" variant="outline" onClick={() => onClose(followUp)}>
            Cerrar
          </Button>
        )}
      </div>
    </li>
  );
}

function OrderCard({
  order,
  onAction,
  onCloseFollowUp,
}: {
  order: ClinicalOrder;
  onAction: (order: ClinicalOrder, action: OrderAction) => void;
  onCloseFollowUp: (followUp: ClinicalFollowUp) => void;
}) {
  const result = order.currentResult;
  const actions = availableActions(order);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{order.studyName}</CardTitle>
            <CardDescription>
              {ORDER_TYPE_LABELS[order.orderType]} · {formatDate(order.orderedAt)} ·{' '}
              {person(order.orderedBy)}
              {order.provider && ` · ${order.provider}`}
              {order.externalReference && ` (${order.externalReference})`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {order.priority !== 'ROUTINE' && (
              <Badge variant={order.priority === 'URGENT' ? 'destructive' : 'outline'}>
                {ORDER_PRIORITY_LABELS[order.priority]}
              </Badge>
            )}
            <StatusBadge order={order} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {order.indication && (
          <p>
            <span className="text-muted-foreground">Indicación: </span>
            {order.indication}
          </p>
        )}
        {order.sampleCollectedAt && (
          <p className="text-muted-foreground">
            Muestra tomada el {formatDate(order.sampleCollectedAt)}
            {order.sampleNotes && ` — ${order.sampleNotes}`}
          </p>
        )}
        {result && (
          <div className="space-y-2 rounded-md bg-muted/40 p-3">
            <p className="font-medium">
              Resultado{order.results.length > 1 ? ` (versión ${result.version})` : ''} · recibido el{' '}
              {formatDate(result.receivedAt)}
              {result.issuedBy && ` · ${result.issuedBy}`}
            </p>
            {result.content && <p className="whitespace-pre-wrap">{result.content}</p>}
            {result.file && <p className="text-muted-foreground">Archivo: {result.file.fileName}</p>}
            {result.reviewedAt ? (
              <p>
                <span className="text-muted-foreground">Revisado por {person(result.reviewedBy)} el </span>
                {formatDate(result.reviewedAt)}: {REVIEW_DECISION_LABELS[result.reviewDecision!]}.{' '}
                {result.reviewNote}
                {result.appointmentNeeded && ' Requiere una cita adicional.'}
              </p>
            ) : (
              <p className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Pendiente de revisión
              </p>
            )}
            {result.communicatedAt ? (
              <p className="text-muted-foreground">
                Informado al paciente el {formatDate(result.communicatedAt)} (
                {CONTACT_CHANNEL_LABELS[result.communicationChannel!]})
                {result.communicationNote && ` — ${result.communicationNote}`}
              </p>
            ) : (
              result.reviewedAt && <p className="text-muted-foreground">Aún no se registra la comunicación al paciente.</p>
            )}
          </div>
        )}
        {order.cancellationReason && (
          <p className="text-muted-foreground">Motivo: {order.cancellationReason}</p>
        )}
        {order.completionNote && (
          <p className="text-muted-foreground">Nota de cierre: {order.completionNote}</p>
        )}
        {order.followUps.length > 0 && (
          <ul className="space-y-2">
            {order.followUps.map((followUp) => (
              <FollowUpItem key={followUp.id} followUp={followUp} onClose={onCloseFollowUp} />
            ))}
          </ul>
        )}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {actions.map((action) => (
              <Button
                key={action}
                size="sm"
                variant={action === 'review' ? 'default' : action === 'cancel' ? 'ghost' : 'outline'}
                onClick={() => onAction(order, action)}
              >
                {action === 'result' && result ? 'Nueva versión del resultado' : ACTION_LABELS[action]}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Orders the professional places for the patient. Inside an open encounter of theirs the order
 * joins it and is signed when the encounter closes; otherwise saving signs it with the password.
 */
function NewOrderDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const userId = useAuthStore((state) => state.user?.id);
  const { data: encounters = [] } = usePatientEncounters(patientId);
  const openEncounter = encounters.find(
    (encounter) => encounter.status === 'OPEN' && encounter.professionalId === userId,
  );
  const create = useCreateClinicalOrder(patientId);
  const [orderType, setOrderType] = useState<ClinicalOrderType>('LABORATORY');
  const [priority, setPriority] = useState<ClinicalOrderPriority>('ROUTINE');
  const [studyName, setStudyName] = useState('');
  const [indication, setIndication] = useState('');
  const [provider, setProvider] = useState('');
  const [resultDue, setResultDue] = useState('');
  const [inEncounter, setInEncounter] = useState(true);
  const [password, setPassword] = useState('');
  const encounterId = openEncounter && inEncounter ? openEncounter.id : undefined;
  const passwordError = signaturePasswordError(create.error);

  const submit = () =>
    create.mutate(
      {
        orderType,
        priority,
        studyName: studyName.trim(),
        indication: indication.trim() || undefined,
        provider: provider.trim() || undefined,
        resultDueAt: resultDue ? dayToIso(resultDue) : undefined,
        encounterId,
        password: encounterId ? undefined : password,
      },
      // The password lives only in this form: emptied after every attempt.
      { onSuccess: onClose, onSettled: () => setPassword('') },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva orden</DialogTitle>
          <DialogDescription>
            El estudio y su indicación no se modifican después de guardar. Si no se realiza, la orden se anula con su motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="order-type">Tipo</Label>
              <select id="order-type" className={selectClass} value={orderType} onChange={(e) => setOrderType(e.target.value as ClinicalOrderType)}>
                {(Object.keys(ORDER_TYPE_LABELS) as ClinicalOrderType[]).map((key) => (
                  <option key={key} value={key}>
                    {ORDER_TYPE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="order-priority">Prioridad</Label>
              <select id="order-priority" className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as ClinicalOrderPriority)}>
                {(Object.keys(ORDER_PRIORITY_LABELS) as ClinicalOrderPriority[]).map((key) => (
                  <option key={key} value={key}>
                    {ORDER_PRIORITY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="order-study">
              Estudio o procedimiento<span className="text-destructive"> *</span>
            </Label>
            <Input id="order-study" value={studyName} maxLength={300} onChange={(e) => setStudyName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="order-indication">Indicación</Label>
            <Textarea id="order-indication" rows={2} value={indication} onChange={(e) => setIndication(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="order-provider-new">Laboratorio o proveedor</Label>
              <Input id="order-provider-new" value={provider} maxLength={200} onChange={(e) => setProvider(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="order-due">Resultado esperado para</Label>
              <Input id="order-due" type="date" value={resultDue} onChange={(e) => setResultDue(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Vacío: según el plazo del consultorio.</p>
            </div>
          </div>
          {openEncounter && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={inEncounter} onChange={(e) => setInEncounter(e.target.checked)} />
              Incluir en la atención abierta (se firma al cerrarla)
            </label>
          )}
          {!encounterId && (
            <SignaturePasswordField
              id="order-password"
              value={password}
              onChange={setPassword}
              error={passwordError}
              disabled={create.isPending}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending || !studyName.trim() || (!encounterId && !password)}>
            {encounterId ? 'Guardar orden' : 'Guardar y firmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewFollowUpDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const userId = useAuthStore((state) => state.user?.id);
  const create = useCreateClinicalFollowUp(patientId);
  const [value, setValue] = useState({ title: '', dueDate: '', assignedToId: userId ?? '' });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo seguimiento</DialogTitle>
          <DialogDescription>
            Un pendiente clínico con responsable y fecha, como un control preventivo. Solo se cierra a mano, con lo que se hizo.
          </DialogDescription>
        </DialogHeader>
        <FollowUpFields idPrefix="new-follow-up" value={value} onChange={setValue} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={create.isPending || !value.title.trim() || !value.dueDate}
            onClick={() =>
              create.mutate(
                {
                  title: value.title.trim(),
                  dueDate: dayToIso(value.dueDate),
                  assignedToId: value.assignedToId || undefined,
                },
                { onSuccess: onClose },
              )
            }
          >
            Crear seguimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Orders, results and follow-ups of one patient. */
export function ClinicalOrdersTab({ patientId }: { patientId: string }) {
  const ordersQuery = usePatientClinicalOrders(patientId);
  const followUpsQuery = usePatientClinicalFollowUps(patientId);
  const [creating, setCreating] = useState(false);
  const [creatingFollowUp, setCreatingFollowUp] = useState(false);
  const [acting, setActing] = useState<{ order: ClinicalOrder; action: OrderAction } | null>(null);
  const [closingFollowUp, setClosingFollowUp] = useState<ClinicalFollowUp | null>(null);

  const orders = ordersQuery.data ?? [];
  const open = orders.filter((order) => !CLOSED_ORDER_STATUSES.includes(order.status));
  const closed = orders.filter((order) => CLOSED_ORDER_STATUSES.includes(order.status));
  // Follow-ups that come from no order: the ones of an order are shown with it.
  const looseFollowUps = (followUpsQuery.data ?? []).filter((followUp) => !followUp.orderId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" /> Órdenes y resultados
            </CardTitle>
            <CardDescription>
              Cada resultado queda pendiente hasta que un profesional lo revisa, y la orden se cierra solo con la revisión y sus seguimientos resueltos.
            </CardDescription>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nueva orden
          </Button>
        </CardHeader>
      </Card>

      {ordersQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : ordersQuery.isError ? (
        <Alert variant="destructive">No fue posible cargar las órdenes.</Alert>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este paciente no tiene órdenes.</p>
      ) : (
        <div className="space-y-4">
          {open.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAction={(target, action) => setActing({ order: target, action })}
              onCloseFollowUp={setClosingFollowUp}
            />
          ))}
          {closed.length > 0 && (
            <details className="space-y-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Órdenes cerradas ({closed.length})
              </summary>
              <div className="mt-4 space-y-4">
                {closed.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAction={(target, action) => setActing({ order: target, action })}
                    onCloseFollowUp={setClosingFollowUp}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-5 w-5" /> Otros seguimientos
            </CardTitle>
            <CardDescription>Pendientes clínicos que no vienen de una orden.</CardDescription>
          </div>
          <Button variant="outline" onClick={() => setCreatingFollowUp(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo seguimiento
          </Button>
        </CardHeader>
        <CardContent>
          {followUpsQuery.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : followUpsQuery.isError ? (
            <Alert variant="destructive">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>No fue posible cargar los seguimientos: puede haber pendientes que no se ven aquí.</span>
                <Button size="sm" variant="outline" onClick={() => void followUpsQuery.refetch()}>
                  Reintentar
                </Button>
              </div>
            </Alert>
          ) : looseFollowUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin seguimientos.</p>
          ) : (
            <ul className="space-y-2">
              {looseFollowUps.map((followUp) => (
                <FollowUpItem key={followUp.id} followUp={followUp} onClose={setClosingFollowUp} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {creating && <NewOrderDialog patientId={patientId} onClose={() => setCreating(false)} />}
      {creatingFollowUp && (
        <NewFollowUpDialog patientId={patientId} onClose={() => setCreatingFollowUp(false)} />
      )}
      {acting && (
        <OrderActionDialog
          // The order as it is now: after a version conflict the list reloads and the dialog follows.
          order={orders.find((order) => order.id === acting.order.id) ?? acting.order}
          action={acting.action}
          onClose={() => setActing(null)}
        />
      )}
      {closingFollowUp && (
        <CloseFollowUpDialog
          followUp={
            [...(followUpsQuery.data ?? []), ...orders.flatMap((order) => order.followUps)].find(
              (followUp) => followUp.id === closingFollowUp.id,
            ) ?? closingFollowUp
          }
          onClose={() => setClosingFollowUp(null)}
        />
      )}
    </div>
  );
}
