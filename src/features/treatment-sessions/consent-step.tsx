'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { SignaturePad } from '@/features/clinical-forms/signature-pad';
import { isMinor } from '@/features/patients/patient-identity';
import { useSessionCommand } from '@/hooks/useTreatmentSessions';
import { treatmentSessionsApi } from '@/lib/api/endpoints';
import { downloadBlob, formatDate } from '@/lib/utils';
import type { ApiError } from '@/types';
import type {
  ConsentDocument,
  ConsentDocumentSignature,
  ConsentDocumentStatus,
  ConsentDocumentSummary,
  ConsentSignerRole,
  SessionPatient,
  SignConsentInput,
  TreatmentSessionDetail,
} from '@/types/treatments';

const DOCUMENT_STATUS_LABELS: Record<ConsentDocumentStatus, string> = {
  PRESENTED: 'Presentado',
  SIGNED: 'Firmado',
  REFUSED: 'Rechazado',
  REVOKED: 'Revocado',
};

const SIGNER_ROLE_LABELS: Record<ConsentSignerRole, string> = {
  PATIENT: 'Paciente',
  REPRESENTATIVE: 'Representante legal',
};

// Tablet first: every control is at least 44px tall.
const FIELD_CLASS = 'h-11';
const SELECT_CLASS = 'mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm';
// Pixels of tolerance when deciding that the reader reached the end of the text.
const END_TOLERANCE = 8;
// The limits of the API's DTOs.
const SIGNER_NAME = { min: 2, max: 200 };
const SIGNER_IDENTIFICATION_MAX = 30;
const RELATIONSHIP_MAX = 100;
const REASON = { min: 3, max: 1000 };

const errorMessage = (error: unknown, fallback: string) =>
  (error as ApiError | undefined)?.message || fallback;

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The signature time in the clinic's zone when the API sends it, otherwise in the zone of this
 * device; the zone is always named so that nobody reads the time as another one.
 */
export function formatSignedAt(iso: string, timeZone?: string): string {
  const format = (zone: string) =>
    `${new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short', timeZone: zone }).format(new Date(iso))} (${zone})`;
  if (timeZone) {
    try {
      return format(timeZone);
    } catch {
      // A zone this browser does not know: the device zone, named, is still correct.
    }
  }
  return format(deviceZone());
}

export interface ConsentStepProps {
  session: TreatmentSessionDetail;
  /** Called once a signature, refusal or revocation is stored and the session moved on. */
  onDone?: () => void;
}

/** Shows the consent to the patient, collects the signature or the refusal, and shows the result. */
export function ConsentStep({ session, onDone }: ConsentStepProps) {
  const commands = useSessionCommand(session.id);
  // The body comes only from presenting: the session detail lists documents without it.
  const [presented, setPresented] = useState<ConsentDocument | null>(null);
  // What the sign response returned, kept until the session detail reports it.
  const [signed, setSigned] = useState<{
    document: ConsentDocumentSummary;
    signer: ConsentDocumentSignature;
  } | null>(null);
  const [presentError, setPresentError] = useState<string | null>(null);

  if (!session.policy.informedConsent.required) {
    return (
      <p className="text-sm text-muted-foreground">
        Este tratamiento no requiere consentimiento informado.
      </p>
    );
  }

  const documents = session.consentDocuments;
  const changedOnServer = (id: string, status: ConsentDocumentStatus) =>
    documents.some((document) => document.id === id && document.status !== status);

  const localSigned = signed && !changedOnServer(signed.document.id, 'SIGNED') ? signed : null;
  const signedDocument =
    localSigned?.document ??
    documents.find((document) => document.status === 'SIGNED' && document.id === session.consentDocumentId) ??
    documents.find((document) => document.status === 'SIGNED');
  const reading =
    !signedDocument && presented && !changedOnServer(presented.id, 'PRESENTED') ? presented : null;
  const canPresent =
    session.allowedCommands.includes('PRESENT_CONSENT') && !signedDocument && !reading;
  const history = documents.filter(
    (document) => document.id !== signedDocument?.id && document.status !== 'PRESENTED',
  );

  const present = async () => {
    setPresentError(null);
    try {
      setPresented(await commands.presentConsent.mutateAsync());
    } catch (error) {
      setPresentError(errorMessage(error, 'No se pudo presentar el consentimiento.'));
    }
  };

  return (
    <div className="space-y-6">
      {signedDocument && (
        <SignedConsent
          document={signedDocument}
          sessionId={session.id}
          timeZone={session.timezone}
          signer={
            signedDocument.signature ??
            (signed?.document.id === signedDocument.id
              ? (signed.document.signature ?? signed.signer)
              : undefined)
          }
          canRevoke={session.allowedCommands.includes('REVOKE_CONSENT')}
          onRevoke={async (reason) => {
            await commands.revokeConsent.mutateAsync({ documentId: signedDocument.id, reason });
            onDone?.();
          }}
        />
      )}

      {reading && (
        <ConsentReader
          document={reading}
          patient={session.patient}
          onSign={async (input, signer) => {
            const document = await commands.signConsent.mutateAsync({
              documentId: reading.id,
              input,
            });
            setSigned({ document, signer });
            onDone?.();
          }}
          signing={commands.signConsent.isPending}
          onRefuse={async (reason) => {
            await commands.refuseConsent.mutateAsync({ documentId: reading.id, reason });
            setPresented(null);
            onDone?.();
          }}
        />
      )}

      {canPresent && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Entrega el dispositivo al paciente para que lea el consentimiento completo antes de firmar.
          </p>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={present}
            loading={commands.presentConsent.isPending}
          >
            <FileText className="h-4 w-4" />
            Mostrar consentimiento al paciente
          </Button>
          {presentError && <Alert variant="destructive">{presentError}</Alert>}
        </div>
      )}

      {!signedDocument && !reading && !canPresent && history.length === 0 && (
        <p className="text-sm text-muted-foreground">
          El consentimiento se presenta cuando la ficha esté lista.
        </p>
      )}

      {history.length > 0 && (
        <section aria-label="Consentimientos anteriores" className="space-y-2">
          {history.map((document) => {
            const at = document.revokedAt ?? document.refusedAt ?? document.presentedAt;
            return (
              <div
                key={document.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-input p-3 text-sm"
              >
                <span className="font-medium">{document.title}</span>
                <Badge variant={document.status === 'SIGNED' ? 'success' : 'destructive'}>
                  {DOCUMENT_STATUS_LABELS[document.status]}
                </Badge>
                <span className="text-muted-foreground">{formatDate(at, 'dd/MM/yyyy HH:mm')}</span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function prefill(patient: SessionPatient, role: ConsentSignerRole) {
  return role === 'PATIENT'
    ? {
        signerName: `${patient.firstName} ${patient.lastName}`.trim(),
        signerIdentification: patient.identificationNumber ?? '',
        relationship: '',
      }
    : {
        signerName: patient.guardianName ?? '',
        signerIdentification: patient.guardianIdentification ?? '',
        relationship: patient.guardianRelationship ?? '',
      };
}

function ConsentReader({
  document,
  patient,
  onSign,
  signing,
  onRefuse,
}: {
  document: ConsentDocument;
  patient: SessionPatient;
  onSign: (input: SignConsentInput, signer: ConsentDocumentSignature) => Promise<void>;
  signing: boolean;
  onRefuse: (reason: string) => Promise<void>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const titleId = useId();

  // A text short enough to be seen whole needs no scrolling.
  useEffect(() => {
    const panel = panelRef.current;
    if (panel && panel.scrollHeight <= panel.clientHeight + END_TOLERANCE) setReachedEnd(true);
  }, [document.id]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const panel = event.currentTarget;
    if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - END_TOLERANCE) {
      setReachedEnd(true);
    }
  };

  return (
    <div className="space-y-6">
      <div
        ref={panelRef}
        role="document"
        aria-label="Texto del consentimiento"
        tabIndex={0}
        onScroll={handleScroll}
        className="max-h-[55vh] overflow-y-auto rounded-md border border-input bg-background p-4 text-base leading-relaxed sm:p-6"
      >
        <h3 id={titleId} className="mb-4 text-lg font-semibold">
          {document.title}
        </h3>
        <p className="whitespace-pre-wrap">{document.body}</p>
      </div>

      {reachedEnd ? (
        <SignForm
          patient={patient}
          onSign={onSign}
          signing={signing}
          onRefuse={() => setRefusing(true)}
        />
      ) : (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Desplázate hasta el final del texto para firmar.
        </p>
      )}

      {refusing && (
        <ReasonDialog
          title="Rechazar consentimiento"
          description="El paciente no acepta el procedimiento. La atención termina y el motivo queda registrado."
          confirmLabel="Rechazar consentimiento"
          onConfirm={onRefuse}
          onClose={() => setRefusing(false)}
        />
      )}
    </div>
  );
}

function SignForm({
  patient,
  onSign,
  signing,
  onRefuse,
}: {
  patient: SessionPatient;
  onSign: (input: SignConsentInput, signer: ConsentDocumentSignature) => Promise<void>;
  signing: boolean;
  onRefuse: () => void;
}) {
  const initialRole: ConsentSignerRole = isMinor(patient.dateOfBirth) ? 'REPRESENTATIVE' : 'PATIENT';
  const [role, setRole] = useState<ConsentSignerRole>(initialRole);
  const [fields, setFields] = useState(() => prefill(patient, initialRole));
  const [understood, setUnderstood] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(false);
  const [marketingPhotos, setMarketingPhotos] = useState(false);
  const [signature, setSignature] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isRepresentative = role === 'REPRESENTATIVE';
  const name = fields.signerName.trim();
  const identification = fields.signerIdentification.trim();
  const relation = fields.relationship.trim();
  // Messages only for what was typed; an empty required field just keeps "Firmar" disabled.
  const fieldErrors = {
    signerName:
      name.length > SIGNER_NAME.max
        ? `El nombre admite hasta ${SIGNER_NAME.max} caracteres.`
        : name.length > 0 && name.length < SIGNER_NAME.min
          ? `El nombre debe tener al menos ${SIGNER_NAME.min} caracteres.`
          : undefined,
    signerIdentification:
      identification.length > SIGNER_IDENTIFICATION_MAX
        ? `La identificación admite hasta ${SIGNER_IDENTIFICATION_MAX} caracteres.`
        : undefined,
    relationship:
      isRepresentative && relation.length > RELATIONSHIP_MAX
        ? `La relación admite hasta ${RELATIONSHIP_MAX} caracteres.`
        : undefined,
  };
  const ready =
    understood &&
    questionsAnswered &&
    Boolean(signature) &&
    name.length >= SIGNER_NAME.min &&
    (!isRepresentative || relation.length > 0) &&
    Object.values(fieldErrors).every((message) => !message);

  const changeRole = (next: ConsentSignerRole) => {
    setRole(next);
    setFields(prefill(patient, next));
  };
  const setField = (key: keyof typeof fields) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || signing) return;
    setError(null);
    const input: SignConsentInput = {
      signerRole: role,
      signerName: name,
      ...(identification ? { signerIdentification: identification } : {}),
      ...(isRepresentative ? { relationship: relation } : {}),
      understood,
      questionsAnswered,
      marketingPhotos,
      signature,
    };
    try {
      await onSign(input, {
        signerName: name,
        signerRole: role,
        relationship: isRepresentative ? relation : null,
      });
    } catch (failure) {
      // Nothing was signed: the form keeps what was filled so it can be sent again.
      setError(errorMessage(failure, 'No se pudo registrar la firma.'));
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="consent-signer-role">Firma como</Label>
          <select
            id="consent-signer-role"
            value={role}
            onChange={(event) => changeRole(event.target.value as ConsentSignerRole)}
            className={SELECT_CLASS}
          >
            {(Object.keys(SIGNER_ROLE_LABELS) as ConsentSignerRole[]).map((value) => (
              <option key={value} value={value}>
                {SIGNER_ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="consent-signer-name">
            Nombre de quien firma<span className="text-destructive"> *</span>
          </Label>
          <Input
            id="consent-signer-name"
            className={FIELD_CLASS}
            maxLength={SIGNER_NAME.max}
            value={fields.signerName}
            onChange={setField('signerName')}
            error={fieldErrors.signerName}
            errorId="consent-signer-name-error"
            aria-invalid={Boolean(fieldErrors.signerName)}
            aria-describedby={fieldErrors.signerName ? 'consent-signer-name-error' : undefined}
          />
        </div>
        <div>
          <Label htmlFor="consent-signer-identification">Identificación</Label>
          <Input
            id="consent-signer-identification"
            className={FIELD_CLASS}
            maxLength={SIGNER_IDENTIFICATION_MAX}
            value={fields.signerIdentification}
            onChange={setField('signerIdentification')}
            error={fieldErrors.signerIdentification}
            errorId="consent-signer-identification-error"
            aria-invalid={Boolean(fieldErrors.signerIdentification)}
            aria-describedby={
              fieldErrors.signerIdentification ? 'consent-signer-identification-error' : undefined
            }
          />
        </div>
        {isRepresentative && (
          <div>
            <Label htmlFor="consent-signer-relationship">
              Relación con el paciente<span className="text-destructive"> *</span>
            </Label>
            <Input
              id="consent-signer-relationship"
              className={FIELD_CLASS}
              maxLength={RELATIONSHIP_MAX}
              value={fields.relationship}
              onChange={setField('relationship')}
              error={fieldErrors.relationship}
              errorId="consent-signer-relationship-error"
              aria-invalid={Boolean(fieldErrors.relationship)}
              aria-describedby={
                fieldErrors.relationship ? 'consent-signer-relationship-error' : undefined
              }
            />
          </div>
        )}
      </div>

      <fieldset className="space-y-1">
        <legend className="sr-only">Declaraciones</legend>
        <Declaration
          id="consent-understood"
          label="Recibí la información y la comprendí"
          checked={understood}
          onChange={setUnderstood}
        />
        <Declaration
          id="consent-questions"
          label="Pude hacer preguntas y fueron respondidas"
          checked={questionsAnswered}
          onChange={setQuestionsAnswered}
        />
        <Declaration
          id="consent-marketing"
          label="Autorizo el uso publicitario de mis fotos (opcional)"
          checked={marketingPhotos}
          onChange={setMarketingPhotos}
        />
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="consent-signature">
          Firma<span className="text-destructive"> *</span>
        </Label>
        <SignaturePad
          id="consent-signature"
          label="Firma de quien consiente"
          value={signature}
          onChange={setSignature}
          disabled={signing}
          fullWidth
        />
      </div>

      {error && (
        <Alert variant="destructive" title="No se registró la firma">
          {error}
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" size="lg" variant="outline" onClick={onRefuse} disabled={signing}>
          Rechazar
        </Button>
        <Button type="submit" size="lg" disabled={!ready} loading={signing}>
          Firmar
        </Button>
      </div>
    </form>
  );
}

function Declaration({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-6 w-6 shrink-0 rounded border-input"
      />
      <Label htmlFor={id} className="py-2 text-base font-normal">
        {label}
      </Label>
    </div>
  );
}

function SignedConsent({
  document,
  sessionId,
  timeZone,
  signer,
  canRevoke,
  onRevoke,
}: {
  document: ConsentDocumentSummary;
  sessionId: string;
  timeZone?: string;
  signer?: ConsentDocumentSignature;
  canRevoke: boolean;
  onRevoke: (reason: string) => Promise<unknown>;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const pdf = await treatmentSessionsApi.consentPdf(document.id);
      downloadBlob(pdf, `consentimiento-${document.id}.pdf`);
    } catch (error) {
      setDownloadError(errorMessage(error, 'No se pudo descargar el PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-md border border-green-500/50 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
        <h3 className="text-lg font-semibold">{document.title}</h3>
        <Badge variant="success">{DOCUMENT_STATUS_LABELS.SIGNED}</Badge>
      </div>
      {document.treatmentSessionId !== sessionId && (
        <p className="text-sm text-muted-foreground">
          Firmado en una atención anterior del mismo tratamiento y aún vigente.
        </p>
      )}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {signer && (
          <>
            <dt className="text-muted-foreground">Firmó</dt>
            <dd>
              {signer.signerName} · {SIGNER_ROLE_LABELS[signer.signerRole]}
              {signer.relationship ? ` (${signer.relationship})` : ''}
            </dd>
          </>
        )}
        {document.signedAt && (
          <>
            <dt className="text-muted-foreground">Fecha y hora</dt>
            <dd>{formatSignedAt(document.signedAt, timeZone)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Huella del texto</dt>
        <dd className="font-mono">{document.checksum.slice(0, 12)}</dd>
      </dl>
      {downloadError && <Alert variant="destructive">{downloadError}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" variant="outline" onClick={download} loading={downloading}>
          <Download className="h-4 w-4" />
          Descargar PDF
        </Button>
        {canRevoke && (
          <Button size="lg" variant="outline" onClick={() => setRevoking(true)}>
            Revocar consentimiento
          </Button>
        )}
      </div>

      {revoking && (
        <ReasonDialog
          title="Revocar consentimiento"
          description="El paciente retira su consentimiento. Si la atención no ha comenzado, termina; otras atenciones que lo reutilizaban vuelven a pedir consentimiento."
          confirmLabel="Revocar consentimiento"
          onConfirm={onRevoke}
          onClose={() => setRevoking(false)}
        />
      )}
    </div>
  );
}

function ReasonDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const length = reason.trim().length;
  const reasonError =
    length > 0 && length < REASON.min
      ? `El motivo debe tener al menos ${REASON.min} caracteres.`
      : length > REASON.max
        ? `El motivo admite hasta ${REASON.max} caracteres.`
        : undefined;
  const valid = length >= REASON.min && !reasonError;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (failure) {
      // The dialog stays open with the reason to retry.
      setError(errorMessage(failure, 'No se pudo completar la acción.'));
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle id={titleId}>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="consent-reason">
              Motivo<span className="text-destructive"> *</span>
            </Label>
            <Textarea
              id="consent-reason"
              rows={3}
              maxLength={REASON.max}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? 'consent-reason-error' : undefined}
            />
            {reasonError && (
              <p id="consent-reason-error" className="mt-1 text-sm text-destructive">
                {reasonError}
              </p>
            )}
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter className="gap-2">
            <Button type="button" size="lg" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" variant="destructive" disabled={!valid} loading={pending}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
