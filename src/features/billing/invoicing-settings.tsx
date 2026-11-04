'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBranches } from '@/hooks/useBranches';
import { invoicingKeys } from '@/hooks/useInvoicing';
import { requireTenantId, useTenantId } from '@/hooks/useTenantScope';
import { invoicingApi } from '@/lib/api/invoicing-api';
import {
  emissionPointSchema,
  issuerSchema,
  type EmissionPointFormData,
  type EmissionPointFormValues,
  type IssuerFormData,
  type IssuerFormValues,
} from '@/lib/validations/schemas';
import { useAuthStore } from '@/store/authStore';
import type { ApiError } from '@/types';
import { isMasterRole } from '@/types/guards';
import type { EmissionPoint, InvoicingIssuer, IssuerTest } from '@/types/invoicing';

const selectClass = 'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const MAX_CERTIFICATE_BYTES = 50 * 1024;
const EXPIRY_WARNING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const CERTIFICATE_ERRORS: Record<string, string> = {
  INVOICING_CERTIFICATE_REQUIRED: 'Sube la firma electrónica (.p12) del emisor con su contraseña.',
  CERTIFICATE_PASSWORD_INVALID: 'La contraseña de la firma electrónica no es correcta.',
  CERTIFICATE_UNREADABLE:
    'No se pudo leer la firma electrónica. Sube el archivo .p12 o .pfx que entregó la entidad certificadora.',
  CERTIFICATE_EXPIRED: 'La firma electrónica está vencida. Renuévala y súbela nuevamente.',
  CERTIFICATE_NOT_YET_VALID:
    'La firma electrónica todavía no está vigente. Revisa su fecha de inicio de validez.',
  CERTIFICATE_NO_RSA_KEY:
    'La firma electrónica no contiene una clave privada RSA utilizable para firmar comprobantes.',
  CERTIFICATE_KEY_MISMATCH:
    'La clave privada de la firma electrónica no corresponde a su certificado.',
  CERTIFICATE_RUC_MISMATCH: 'La firma electrónica pertenece a otro RUC distinto al del emisor.',
};

const errorMessage = (error: unknown, fallback: string) =>
  (error as ApiError | undefined)?.message || fallback;

const issuerFormValues = (issuer: InvoicingIssuer | null): IssuerFormValues => ({
  ruc: issuer?.ruc ?? '',
  legalName: issuer?.legalName ?? '',
  tradeName: issuer?.tradeName ?? '',
  headOfficeAddress: issuer?.headOfficeAddress ?? '',
  accountingRequired: issuer?.accountingRequired ?? false,
  specialTaxpayerCode: issuer?.specialTaxpayerCode ?? '',
  withholdingAgentCode: issuer?.withholdingAgentCode ?? '',
  rimpeRegime: issuer?.rimpeRegime ?? 'NONE',
  environment: issuer?.environment ?? '1',
  active: issuer?.active ?? true,
});

// The next sequential always starts blank: only a number the user types is sent.
const pointFormValues = (point?: EmissionPoint): EmissionPointFormValues => ({
  establishmentCode: point?.establishmentCode ?? '',
  emissionPointCode: point?.emissionPointCode ?? '',
  establishmentAddress: point?.establishmentAddress ?? '',
  nextSequential: '',
});
/** The saved point fields the form edits; points have no revision of their own. */
const pointSnapshot = (point?: EmissionPoint) =>
  point
    ? JSON.stringify([point.establishmentCode, point.emissionPointCode, point.establishmentAddress])
    : '';

/** A test result is only valid for the configuration it ran against. */
const testedConfiguration = (issuer: InvoicingIssuer | null) =>
  issuer
    ? JSON.stringify([issuer.revision, issuer.certificate?.sha256 ?? null, issuer.environment])
    : '';

function IssuerCard({
  issuer,
  onSaved,
}: {
  issuer: InvoicingIssuer | null;
  onSaved: (saved: InvoicingIssuer) => void;
}) {
  const tenantId = useTenantId();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<IssuerFormValues, unknown, IssuerFormData>({
    // zodResolver gives the parsed (transformed) values to onSubmit; its types model only the input.
    resolver: zodResolver(issuerSchema) as Resolver<IssuerFormValues, unknown, IssuerFormData>,
    defaultValues: issuerFormValues(issuer),
  });
  // The form values and the revision they were loaded from are one snapshot: the revision is
  // sent with them, so the API refuses to overwrite a configuration that changed meanwhile.
  const [loadedRevision, setLoadedRevision] = useState(issuer?.revision);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // Revisions only grow, so only a newer one counts: right after a save the cache can still hold
  // the older issuer for a render, and that must not reload the pre-save values.
  const changedElsewhere =
    !!issuer && (loadedRevision === undefined || issuer.revision > loadedRevision);

  const load = useCallback(
    (next: InvoicingIssuer | null) => {
      reset(issuerFormValues(next));
      setLoadedRevision(next?.revision);
    },
    [reset],
  );
  useEffect(() => {
    if (changedElsewhere && !isDirty) load(issuer);
  }, [changedElsewhere, isDirty, issuer, load]);

  function reload() {
    load(issuer);
    setError('');
    setMessage('');
  }
  const save = handleSubmit(
    async (data) => {
      setMessage('');
      setError('');
      try {
        const saved = await invoicingApi.saveIssuer(requireTenantId(tenantId), {
          ...data,
          ...(loadedRevision !== undefined ? { revision: loadedRevision } : {}),
        });
        load(saved);
        onSaved(saved);
        setMessage('Emisor guardado');
      } catch (error) {
        setError(errorMessage(error, 'No se pudo guardar el emisor.'));
      }
    },
    () => setMessage(''),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emisor</CardTitle>
        <CardDescription>
          Datos tributarios del consultorio tal como constan en el RUC del SRI.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate className="space-y-4" onSubmit={(event) => void save(event)}>
          {/* Locked while saving: edits typed now would be lost when the saved issuer loads. */}
          <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
            <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="issuer-ruc">RUC</Label>
                <Input
                  id="issuer-ruc"
                  inputMode="numeric"
                  maxLength={13}
                  error={errors.ruc?.message}
                  {...register('ruc')}
                />
              </div>
              <div>
                <Label htmlFor="issuer-legal">Razón social</Label>
                <Input
                  id="issuer-legal"
                  maxLength={300}
                  error={errors.legalName?.message}
                  {...register('legalName')}
                />
              </div>
              <div>
                <Label htmlFor="issuer-trade">Nombre comercial</Label>
                <Input
                  id="issuer-trade"
                  maxLength={300}
                  error={errors.tradeName?.message}
                  {...register('tradeName')}
                />
              </div>
              <div>
                <Label htmlFor="issuer-address">Dirección de la matriz</Label>
                <Input
                  id="issuer-address"
                  maxLength={300}
                  error={errors.headOfficeAddress?.message}
                  {...register('headOfficeAddress')}
                />
              </div>
              <div>
                <Label htmlFor="issuer-special">Contribuyente especial (código)</Label>
                <Input
                  id="issuer-special"
                  inputMode="numeric"
                  maxLength={13}
                  error={errors.specialTaxpayerCode?.message}
                  {...register('specialTaxpayerCode')}
                />
              </div>
              <div>
                <Label htmlFor="issuer-withholding">Agente de retención (código)</Label>
                <Input
                  id="issuer-withholding"
                  inputMode="numeric"
                  maxLength={8}
                  error={errors.withholdingAgentCode?.message}
                  {...register('withholdingAgentCode')}
                />
              </div>
              <div>
                <Label htmlFor="issuer-rimpe">Régimen RIMPE</Label>
                <select id="issuer-rimpe" className={selectClass} {...register('rimpeRegime')}>
                  <option value="NONE">Ninguno</option>
                  <option value="EMPRENDEDOR">Emprendedor</option>
                  <option value="NEGOCIO_POPULAR" disabled>
                    Negocio Popular · Aún no disponible
                  </option>
                </select>
                {errors.rimpeRegime && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {errors.rimpeRegime.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="issuer-environment">Ambiente</Label>
                <select id="issuer-environment" className={selectClass} {...register('environment')}>
                  <option value="1">Pruebas</option>
                  <option value="2">Producción</option>
                </select>
                {errors.environment && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {errors.environment.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('accountingRequired')} />
                Obligado a llevar contabilidad
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('active')} />
                Emisor activo
              </label>
            </div>
          </fieldset>
          {watch('environment') === '1' && (
            <p className="text-sm text-muted-foreground">
              En pruebas los comprobantes no tienen validez tributaria.
            </p>
          )}
          {changedElsewhere && isDirty && (
            <Alert variant="warning">
              La configuración del emisor cambió mientras editabas (en otra sesión o al subir la
              firma). Recarga los datos actuales antes de guardar; tus cambios sin guardar se
              descartarán.{' '}
              <Button type="button" variant="link" onClick={reload}>
                Recargar datos del emisor
              </Button>
            </Alert>
          )}
          <Button
            type="submit"
            // Without a loaded revision the API could not detect the conflict, so wait for a reload.
            disabled={isSubmitting || (changedElsewhere && loadedRevision === undefined)}
          >
            Guardar emisor
          </Button>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
        </form>
      </CardContent>
    </Card>
  );
}

function CertificateCard({
  issuer,
  onSaved,
}: {
  issuer: InvoicingIssuer | null;
  onSaved: (saved: InvoicingIssuer) => void;
}) {
  const tenantId = useTenantId();
  const [file, setFile] = useState<File | null>(null);
  // The password lives only in the DOM input: it is read once on submit and wiped afterwards.
  const passwordRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const certificate = issuer?.certificate ?? null;
  const validTo = certificate ? new Date(certificate.validTo) : null;
  const days = validTo ? Math.ceil((validTo.getTime() - Date.now()) / DAY_MS) : null;
  const expired = validTo ? validTo.getTime() <= Date.now() : false;

  async function upload() {
    setMessage('');
    const password = passwordRef.current?.value ?? '';
    if (!file) return setError('Selecciona el archivo de la firma (.p12 o .pfx).');
    if (file.size > MAX_CERTIFICATE_BYTES)
      return setError('El archivo supera los 50 KB. Revisa que sea la firma .p12.');
    if (!password) return setError('Ingresa la contraseña de la firma.');
    setError('');
    setPending(true);
    try {
      const saved = await invoicingApi.uploadCertificate(requireTenantId(tenantId), file, password);
      onSaved(saved);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setMessage('Firma electrónica guardada');
    } catch (error) {
      setError(errorMessage(error, 'No se pudo guardar la firma electrónica.'));
    } finally {
      if (passwordRef.current) passwordRef.current.value = '';
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Firma electrónica</CardTitle>
        <CardDescription>
          Archivo .p12 o .pfx con el que se firman las facturas. Se guarda cifrado y la contraseña
          no se vuelve a mostrar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!issuer && (
          <p className="text-sm text-muted-foreground">
            Guarda primero los datos del emisor para subir su firma.
          </p>
        )}
        {certificate && validTo && (
          <div className="space-y-2">
            <dl className="grid max-w-xl gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Titular</dt>
              <dd className="break-all">{certificate.subject}</dd>
              <dt className="text-muted-foreground">Serie</dt>
              <dd className="break-all">{certificate.serial}</dd>
              <dt className="text-muted-foreground">Vence</dt>
              <dd>{validTo.toLocaleDateString('es-EC')}</dd>
            </dl>
            {expired ? (
              <Alert variant="destructive">
                {`La firma ya venció el ${validTo.toLocaleDateString('es-EC')}. No se podrán emitir facturas hasta subir una vigente.`}
              </Alert>
            ) : (
              days !== null &&
              days <= EXPIRY_WARNING_DAYS && (
                <Alert variant="warning">
                  {`La firma vence en ${days} ${days === 1 ? 'día' : 'días'}. Renuévala antes para no interrumpir la facturación.`}
                </Alert>
              )
            )}
            {!certificate.rucVerified && (
              <Alert variant="warning">
                No se pudo verificar que la firma pertenezca al RUC del emisor. Confirma que
                subiste la firma correcta.
              </Alert>
            )}
          </div>
        )}
        <div className="max-w-xl space-y-3">
          <div>
            <Label htmlFor="certificate-file">Archivo de firma (.p12 o .pfx)</Label>
            <input
              id="certificate-file"
              ref={fileRef}
              type="file"
              accept=".p12,.pfx"
              disabled={!issuer || pending}
              className="mt-1 block w-full text-sm"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError('');
                setMessage('');
              }}
            />
          </div>
          <div>
            <Label htmlFor="certificate-password">Contraseña de la firma</Label>
            <Input
              id="certificate-password"
              ref={passwordRef}
              type="password"
              autoComplete="new-password"
              maxLength={256}
              disabled={!issuer || pending}
            />
          </div>
          <Button type="button" disabled={!issuer || pending} onClick={() => void upload()}>
            Subir firma
          </Button>
        </div>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {error && <Alert variant="destructive">{error}</Alert>}
      </CardContent>
    </Card>
  );
}

function BranchPoint({
  branch,
  saved,
  onSaved,
}: {
  branch: { id: string; name: string };
  saved?: EmissionPoint;
  onSaved: (point: EmissionPoint) => void;
}) {
  const tenantId = useTenantId();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<EmissionPointFormValues, unknown, EmissionPointFormData>({
    resolver: zodResolver(emissionPointSchema) as Resolver<
      EmissionPointFormValues,
      unknown,
      EmissionPointFormData
    >,
    defaultValues: pointFormValues(saved),
  });
  const [loadedPoint, setLoadedPoint] = useState(() => pointSnapshot(saved));
  // The point the cache held when this form last saved: right after the save it can still arrive
  // for a render, and that must not reload the pre-save values.
  const [supersededPoint, setSupersededPoint] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const incomingPoint = pointSnapshot(saved);
  const changedElsewhere = incomingPoint !== loadedPoint && incomingPoint !== supersededPoint;

  const load = useCallback(
    (next?: EmissionPoint) => {
      reset(pointFormValues(next));
      setLoadedPoint(pointSnapshot(next));
    },
    [reset],
  );
  useEffect(() => {
    if (incomingPoint === loadedPoint) setSupersededPoint(null);
    else if (changedElsewhere && !isDirty) load(saved);
  }, [incomingPoint, loadedPoint, changedElsewhere, isDirty, saved, load]);

  function reload() {
    load(saved);
    setError('');
    setMessage('');
  }
  const save = handleSubmit(
    async ({ nextSequential, ...point }) => {
      const before = pointSnapshot(saved);
      setMessage('');
      setError('');
      try {
        const result = await invoicingApi.savePoint(requireTenantId(tenantId), branch.id, {
          ...point,
          ...(nextSequential !== undefined ? { nextSequential } : {}),
        });
        setSupersededPoint(before);
        load(result);
        onSaved(result);
        setMessage('Punto guardado');
      } catch (error) {
        setError(errorMessage(error, 'No se pudo guardar el punto.'));
      }
    },
    () => setMessage(''),
  );
  return (
    <form
      noValidate
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(event) => void save(event)}
    >
      <h3 className="font-medium">{branch.name}</h3>
      <fieldset disabled={isSubmitting} className="min-w-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`est-${branch.id}`}>Establecimiento · {branch.name}</Label>
            <Input
              id={`est-${branch.id}`}
              inputMode="numeric"
              maxLength={3}
              placeholder="001"
              error={errors.establishmentCode?.message}
              {...register('establishmentCode')}
            />
          </div>
          <div>
            <Label htmlFor={`point-${branch.id}`}>Punto de emisión · {branch.name}</Label>
            <Input
              id={`point-${branch.id}`}
              inputMode="numeric"
              maxLength={3}
              placeholder="001"
              error={errors.emissionPointCode?.message}
              {...register('emissionPointCode')}
            />
          </div>
          <div>
            <Label htmlFor={`addr-${branch.id}`}>
              Dirección del establecimiento · {branch.name}
            </Label>
            <Input
              id={`addr-${branch.id}`}
              maxLength={300}
              error={errors.establishmentAddress?.message}
              {...register('establishmentAddress')}
            />
          </div>
          <div>
            <Label htmlFor={`seq-${branch.id}`}>Siguiente secuencial · {branch.name}</Label>
            <Input
              id={`seq-${branch.id}`}
              inputMode="numeric"
              placeholder={saved ? `Siguiente: ${saved.nextSequential}` : '1'}
              error={errors.nextSequential?.message}
              {...register('nextSequential')}
            />
          </div>
        </div>
      </fieldset>
      {changedElsewhere && isDirty && (
        <Alert variant="warning">
          Este punto cambió mientras lo editabas (en otra sesión). Recarga los datos actuales antes
          de guardar; tus cambios sin guardar se descartarán.{' '}
          <Button type="button" variant="link" onClick={reload}>
            Recargar punto · {branch.name}
          </Button>
        </Alert>
      )}
      <Button type="submit" size="sm" variant="outline" disabled={isSubmitting}>
        Guardar punto · {branch.name}
      </Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
    </form>
  );
}

function PointsCard({
  issuer,
  onPointSaved,
}: {
  issuer: InvoicingIssuer | null;
  onPointSaved: (point: EmissionPoint) => void;
}) {
  const branches = useBranches();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Puntos de emisión</CardTitle>
        <CardDescription>
          Cada sucursal factura con su propio establecimiento y punto de emisión. Cada serie solo
          puede usarla una sucursal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!issuer && (
          <p className="text-sm text-muted-foreground">
            Guarda primero los datos del emisor para asignar puntos de emisión.
          </p>
        )}
        {issuer && branches.isPending && (
          <p role="status" className="text-sm">
            Cargando sucursales…
          </p>
        )}
        {issuer && branches.isError && (
          <Alert variant="destructive">
            No se pudieron cargar las sucursales.{' '}
            <Button type="button" variant="link" onClick={() => void branches.refetch()}>
              Reintentar sucursales
            </Button>
          </Alert>
        )}
        {issuer &&
          branches.data
            ?.filter((branch) => branch.isActive)
            .map((branch) => (
              <BranchPoint
                key={branch.id}
                branch={branch}
                saved={issuer.points.find((item) => item.branchId === branch.id)}
                onSaved={onPointSaved}
              />
            ))}
      </CardContent>
    </Card>
  );
}

function TestCard({ issuer }: { issuer: InvoicingIssuer | null }) {
  const tenantId = useTenantId();
  const configuration = testedConfiguration(issuer);
  const latestConfiguration = useRef(configuration);
  useEffect(() => {
    latestConfiguration.current = configuration;
  }, [configuration]);
  const [outcome, setOutcome] = useState<{
    configuration: string;
    result?: IssuerTest;
    error?: string;
  }>();
  const [pending, setPending] = useState(false);
  // Saving the issuer or replacing the certificate makes a shown result obsolete.
  const current = outcome?.configuration === configuration ? outcome : undefined;
  const result = current?.result;
  const error = current?.error;

  async function run() {
    const startedWith = configuration;
    // A response for a configuration that changed while the test ran is discarded.
    const keep = (next: { result?: IssuerTest; error?: string }) => {
      if (latestConfiguration.current === startedWith)
        setOutcome({ configuration: startedWith, ...next });
    };
    setPending(true);
    setOutcome(undefined);
    try {
      keep({ result: await invoicingApi.test(requireTenantId(tenantId)) });
    } catch (error) {
      keep({ error: errorMessage(error, 'No se pudo ejecutar la prueba.') });
    } finally {
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Probar</CardTitle>
        <CardDescription>
          Comprueba la firma guardada y que los servicios del SRI del ambiente elegido respondan. No
          emite ni guarda nada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          type="button"
          variant="outline"
          disabled={!issuer || pending}
          onClick={() => void run()}
        >
          Probar firma y SRI
        </Button>
        {result && (
          <ul className="space-y-1 text-sm">
            <li>Firma electrónica: {result.certificateValid ? 'válida' : 'con problemas'}</li>
            {result.certificateError && (
              <li className="text-destructive">
                {CERTIFICATE_ERRORS[result.certificateError] ?? result.certificateError}
              </li>
            )}
            <li>RUC de la firma: {result.rucVerified ? 'verificado' : 'no verificado'}</li>
            <li>SRI: {result.sriReachable ? 'disponible' : 'sin respuesta'}</li>
          </ul>
        )}
        {error && <Alert variant="destructive">{error}</Alert>}
      </CardContent>
    </Card>
  );
}

function SettingsForm() {
  const tenantId = useTenantId();
  const client = useQueryClient();
  const issuerQuery = useQuery({
    queryKey: invoicingKeys.issuer(tenantId),
    queryFn: () => invoicingApi.issuer(requireTenantId(tenantId)),
    enabled: !!tenantId,
  });
  const issuer = issuerQuery.data ?? null;
  function replaceIssuer(saved: InvoicingIssuer) {
    client.setQueryData(invoicingKeys.issuer(tenantId), saved);
    void client.invalidateQueries({ queryKey: ['orders'] });
  }
  function replacePoint(point: EmissionPoint) {
    client.setQueryData<InvoicingIssuer | null>(invoicingKeys.issuer(tenantId), (current) =>
      current
        ? {
            ...current,
            points: [...current.points.filter((item) => item.branchId !== point.branchId), point],
          }
        : current,
    );
    void client.invalidateQueries({ queryKey: ['orders'] });
  }
  if (issuerQuery.isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Cargando configuración…
      </p>
    );
  if (issuerQuery.isError)
    return (
      <Alert variant="destructive">
        {errorMessage(issuerQuery.error, 'No se pudo cargar la configuración de facturación.')}{' '}
        <Button type="button" variant="link" onClick={() => void issuerQuery.refetch()}>
          Reintentar
        </Button>
      </Alert>
    );
  return (
    <div className="space-y-6">
      <IssuerCard issuer={issuer} onSaved={replaceIssuer} />
      <CertificateCard issuer={issuer} onSaved={replaceIssuer} />
      <PointsCard issuer={issuer} onPointSaved={replacePoint} />
      <TestCard issuer={issuer} />
    </div>
  );
}

/** Restricted settings never mount their queries for a delegated billing user. */
export function InvoicingSettings() {
  const user = useAuthStore((state) => state.user);
  if (!user || !isMasterRole(user.role)) return null;
  return <SettingsForm />;
}
