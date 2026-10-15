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

const errorMessage = (error: unknown, fallback: string) =>
  (error as ApiError | undefined)?.message || fallback;

/**
 * The signature time in the zone of this device, named so that nobody reads it as another one.
 * The API stores the server time and does not send the clinic's zone with the document.
 */
export function formatSignedAt(iso: string): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const text = new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
  return `${text} (${timeZone})`;
}

interface Signer {
  name: string;
  role: ConsentSignerRole;
  relationship?: string;
}

export interface ConsentStepProps {
  session: TreatmentSessionDetail;
}

/** Shows the consent to the patient, collects the signature or the refusal, and shows the result. */
export function ConsentStep({ session }: ConsentStepProps) {
  const commands = useSessionCommand(session.id);
  // The body comes only from presenting: the session detail lists documents without it.
  const [presented, setPresented] = useState<ConsentDocument | null>(null);
  // What this device signed, kept until the session detail reports it.
  const [signed, setSigned] = useState<{ document: ConsentDocumentSummary; signer: Signer } | null>(
    null,
  );
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
          signer={localSigned?.document.id === signedDocument.id ? localSigned.signer : undefined}
          canRevoke={session.allowedCommands.includes('REVOKE_CONSENT')}
          onRevoke={(reason) =>
            commands.revokeConsent.mutateAsync({ documentId: signedDocument.id, reason })
          }
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
          }}
          signing={commands.signConsent.isPending}
          onRefuse={async (reason) => {
            await commands.refuseConsent.mutateAsync({ documentId: reading.id, reason });
            setPresented(null);
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
  onSign: (input: SignConsentInput, signer: Signer) => Promise<void>;
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
  onSign: (input: SignConsentInput, signer: Signer) => Promise<void>;
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
  const ready =
    understood &&
    questionsAnswered &&
    Boolean(signature) &&
    Boolean(fields.signerName.trim()) &&
    (!isRepresentative || Boolean(fields.relationship.trim()));

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
    const signerName = fields.signerName.trim();
    const signerIdentification = fields.signerIdentification.trim();
    const relationship = fields.relationship.trim();
    const input: SignConsentInput = {
      signerRole: role,
      signerName,
      ...(signerIdentification ? { signerIdentification } : {}),
      ...(isRepresentative ? { relationship } : {}),
      understood,
      questionsAnswered,
      marketingPhotos,
      signature,
    };
    try {
      await onSign(input, {
        name: signerName,
        role,
        ...(isRepresentative ? { relationship } : {}),
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
            maxLength={200}
            value={fields.signerName}
            onChange={setField('signerName')}
          />
        </div>
        <div>
          <Label htmlFor="consent-signer-identification">Identificación</Label>
          <Input
            id="consent-signer-identification"
            className={FIELD_CLASS}
            maxLength={50}
            value={fields.signerIdentification}
            onChange={setField('signerIdentification')}
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
              maxLength={100}
              value={fields.relationship}
              onChange={setField('relationship')}
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
        {/* The pad spans the whole width of the tablet. */}
        <div className="[&_canvas]:h-[220px] [&_canvas]:max-w-none">
          <SignaturePad
            id="consent-signature"
            label="Firma de quien consiente"
            value={signature}
            onChange={setSignature}
            disabled={signing}
          />
        </div>
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
  signer,
  canRevoke,
  onRevoke,
}: {
  document: ConsentDocumentSummary;
  sessionId: string;
  signer?: Signer;
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
              {signer.name} · {SIGNER_ROLE_LABELS[signer.role]}
              {signer.relationship ? ` (${signer.relationship})` : ''}
            </dd>
          </>
        )}
        {document.signedAt && (
          <>
            <dt className="text-muted-foreground">Fecha y hora</dt>
            <dd>{formatSignedAt(document.signedAt)}</dd>
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || pending) return;
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
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter className="gap-2">
            <Button type="button" size="lg" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" variant="destructive" disabled={!reason.trim()} loading={pending}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
