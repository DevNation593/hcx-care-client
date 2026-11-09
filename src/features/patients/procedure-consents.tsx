'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DOCUMENT_STATUS_LABELS,
  ReasonDialog,
  SignForm,
} from '@/features/treatment-sessions/consent-step';
import { usePatient } from '@/hooks/usePatients';
import { procedureConsentsApi } from '@/lib/api/endpoints';
import { QUERY_KEYS } from '@/lib/constants';
import { downloadBlob, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { ApiError } from '@/types';
import type { ProcedureConsent, SessionPatient } from '@/types/treatments';
import { usePatientTerms } from '@/hooks/usePatientTerms';

const STATUS_VARIANT = {
  PRESENTED: 'warning',
  SIGNED: 'success',
  REFUSED: 'destructive',
  REVOKED: 'secondary',
} as const;

const errorMessage = (error: unknown, fallback: string) =>
  (error as ApiError | undefined)?.message || fallback;

function useProcedureConsents(patientId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_PROCEDURE_CONSENTS(patientId),
    queryFn: () => procedureConsentsApi.list(patientId),
  });
}

/**
 * Presents a consent for a procedure in the open encounter and collects the decision: the
 * signature (with an optional witness) or the refusal with its reason. A refusal is recorded and
 * blocks nothing: whether to go ahead is the professional's call.
 */
function TakeConsentDialog({
  patientId,
  encounterId,
  resume,
  onClose,
}: {
  patientId: string;
  encounterId: string;
  /** A consent presented earlier and not decided yet: the dialog opens on its text. */
  resume?: ProcedureConsent;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const terms = usePatientTerms();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_PROCEDURE_CONSENTS(patientId) });
  const templates = useQuery({
    queryKey: QUERY_KEYS.PROCEDURE_CONSENT_TEMPLATES,
    queryFn: () => procedureConsentsApi.templates(),
  });
  const { data: patient } = usePatient(patientId);
  const [templateId, setTemplateId] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [document, setDocument] = useState<ProcedureConsent | null>(resume ?? null);
  const [refusing, setRefusing] = useState(false);
  const present = useMutation({
    mutationFn: () =>
      procedureConsentsApi.present(patientId, encounterId, {
        templateId,
        procedureName: procedureName.trim(),
      }),
    onSuccess: (presented) => {
      setDocument(presented);
      refresh();
    },
  });
  const sign = useMutation({
    mutationFn: (input: Parameters<typeof procedureConsentsApi.sign>[1]) =>
      procedureConsentsApi.sign(document!.id, input),
    onSuccess: () => {
      toast.success('Consentimiento firmado');
      refresh();
      onClose();
    },
  });

  const signer: SessionPatient | null = patient
    ? {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth ?? null,
        identificationNumber: patient.identificationNumber ?? null,
        guardianName: patient.guardianName ?? null,
        guardianRelationship: patient.guardianRelationship ?? null,
        guardianIdentification: patient.guardianIdentification ?? null,
      }
    : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Consentimiento de procedimiento</DialogTitle>
          <DialogDescription>
            Se usa la última versión publicada de la plantilla. El texto, la decisión, quien firma y el PDF quedan guardados
            con su huella.
          </DialogDescription>
        </DialogHeader>

        {!document ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              present.mutate();
            }}
          >
            {templates.isError && (
              <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-2">
                <span>No se pudieron cargar las plantillas de consentimiento.</span>
                <Button type="button" variant="outline" size="sm" onClick={() => templates.refetch()}>
                  Reintentar
                </Button>
              </Alert>
            )}
            {templates.data?.length === 0 && (
              <Alert variant="warning">
                El consultorio no tiene plantillas de consentimiento publicadas. Se crean en Clínica › Consentimientos.
              </Alert>
            )}
            <div>
              <Label htmlFor="procedure-consent-template">Plantilla</Label>
              <select
                id="procedure-consent-template"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                <option value="">Elige una plantilla</option>
                {(templates.data ?? []).map((template) => (
                  <option key={template.templateId} value={template.templateId}>
                    {template.name} (versión {template.version})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="procedure-consent-name">Procedimiento</Label>
              <Input
                id="procedure-consent-name"
                maxLength={200}
                placeholder="Inserción de dispositivo intrauterino"
                value={procedureName}
                onChange={(event) => setProcedureName(event.target.value)}
              />
            </div>
            {present.error && (
              <Alert variant="destructive">{errorMessage(present.error, 'No se pudo presentar el consentimiento.')}</Alert>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!templateId || procedureName.trim().length < 3}
                loading={present.isPending}
              >
                Mostrar al {terms.one}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div
              role="document"
              aria-label="Texto del consentimiento"
              tabIndex={0}
              className="max-h-[40vh] overflow-y-auto rounded-md border border-input p-4 leading-relaxed"
            >
              <h3 className="mb-3 text-lg font-semibold">{document.title}</h3>
              <p className="whitespace-pre-wrap">{document.body}</p>
            </div>
            {signer && (
              <SignForm
                patient={signer}
                withMarketingPhotos={false}
                withWitness
                signing={sign.isPending}
                onRefuse={() => setRefusing(true)}
                onSign={async (input) => {
                  await sign.mutateAsync(input);
                }}
              />
            )}
          </div>
        )}

        {refusing && document && (
          <ReasonDialog
            title="Registrar rechazo"
            description={`El ${terms.one} no acepta el procedimiento. Queda registrado con el motivo; la atención sigue abierta.`}
            confirmLabel="Registrar rechazo"
            onConfirm={async (reason) => {
              await procedureConsentsApi.refuse(document.id, reason);
              toast.success('Rechazo registrado');
              refresh();
              onClose();
            }}
            onClose={() => setRefusing(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The procedure consents of the patient, and taking a new one in the open encounter. */
export function ProcedureConsents({
  patientId,
  openEncounterId,
}: {
  patientId: string;
  openEncounterId?: string;
}) {
  const role = useAuthStore((state) => state.user?.role);
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const consents = useProcedureConsents(patientId);
  const terms = usePatientTerms();
  const [taking, setTaking] = useState(false);
  const [resuming, setResuming] = useState<ProcedureConsent | null>(null);
  const [revoking, setRevoking] = useState<ProcedureConsent | null>(null);

  // A consent presented and left without a decision (the dialog closed, the tab changed) is taken
  // up from its text instead of presenting another one.
  const resume = async (document: ProcedureConsent) => {
    try {
      setResuming(await procedureConsentsApi.get(document.id));
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo abrir el consentimiento.'));
    }
  };

  const download = async (document: ProcedureConsent) => {
    try {
      downloadBlob(await procedureConsentsApi.pdf(document.id), `consentimiento-${document.id}.pdf`);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo descargar el PDF.'));
    }
  };
  const items = consents.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-5 w-5" /> Consentimientos de procedimientos
          </CardTitle>
          <CardDescription>
            {openEncounterId
              ? 'Para un procedimiento de esta atención: DIU, colposcopia, biopsia…'
              : 'Se toman dentro de una atención abierta.'}
          </CardDescription>
        </div>
        {openEncounterId && (
          <Button variant="outline" onClick={() => setTaking(true)}>
            <FileSignature className="mr-2 h-4 w-4" /> Tomar consentimiento
          </Button>
        )}
      </CardHeader>
      {(items.length > 0 || consents.isError) && (
        <CardContent>
          {consents.isError ? (
            <Alert variant="destructive">No se pudieron cargar los consentimientos.</Alert>
          ) : (
            <ul className="space-y-2">
              {items.map((document) => {
                const lastReason = [...document.events].reverse().find((event) => event.reason)?.reason;
                const canResume =
                  document.status === 'PRESENTED' && document.encounter?.professionalId === userId;
                const canRevoke =
                  document.status === 'SIGNED' &&
                  (document.encounter?.professionalId === userId || role === 'MASTER');
                return (
                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{document.procedureName ?? document.title}</p>
                      <p className="text-muted-foreground">
                        {document.templateVersion.template.name} v{document.templateVersion.version} ·{' '}
                        {formatDate(document.signedAt ?? document.refusedAt ?? document.presentedAt, 'dd/MM/yyyy HH:mm')}
                        {document.signature && ` · ${document.signature.signerName}`}
                        {document.signature?.witnessName && ` · testigo: ${document.signature.witnessName}`}
                      </p>
                      {lastReason && <p className="text-muted-foreground">Motivo: {lastReason}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[document.status]}>{DOCUMENT_STATUS_LABELS[document.status]}</Badge>
                      {document.hasPdf && (
                        <Button size="sm" variant="outline" onClick={() => download(document)} aria-label="Descargar PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {canResume && (
                        <Button size="sm" onClick={() => resume(document)}>
                          Continuar
                        </Button>
                      )}
                      {canRevoke && (
                        <Button size="sm" variant="ghost" onClick={() => setRevoking(document)}>
                          Revocar
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      )}

      {taking && openEncounterId && (
        <TakeConsentDialog patientId={patientId} encounterId={openEncounterId} onClose={() => setTaking(false)} />
      )}
      {resuming && (
        <TakeConsentDialog
          patientId={patientId}
          encounterId={resuming.encounterId}
          resume={resuming}
          onClose={() => setResuming(null)}
        />
      )}
      {revoking && (
        <ReasonDialog
          title="Revocar consentimiento"
          description={`El ${terms.one} retira su consentimiento. Queda registrado con el motivo.`}
          confirmLabel="Revocar consentimiento"
          onConfirm={async (reason) => {
            await procedureConsentsApi.revoke(revoking.id, reason);
            toast.success('Consentimiento revocado');
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_PROCEDURE_CONSENTS(patientId) });
          }}
          onClose={() => setRevoking(null)}
        />
      )}
    </Card>
  );
}
