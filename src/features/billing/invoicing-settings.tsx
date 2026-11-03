'use client';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBranches } from '@/hooks/useBranches';
import { invoicingKeys } from '@/hooks/useInvoicing';
import { requireTenantId, useTenantId } from '@/hooks/useTenantScope';
import { invoicingApi } from '@/lib/api/invoicing-api';
import { useAuthStore } from '@/store/authStore';
import type { ApiError } from '@/types';
import { isMasterRole } from '@/types/guards';
import type {
  EmissionPoint,
  InvoicingEnvironment,
  InvoicingIssuer,
  IssuerTest,
  RimpeRegime,
} from '@/types/invoicing';

const selectClass = 'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const MAX_CERTIFICATE_BYTES = 50 * 1024;
const EXPIRY_WARNING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DIGITS = /^(?!000)\d{3}$/;

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

function IssuerCard({
  issuer,
  onSaved,
}: {
  issuer: InvoicingIssuer | null;
  onSaved: (saved: InvoicingIssuer) => void;
}) {
  const tenantId = useTenantId();
  const [ruc, setRuc] = useState(issuer?.ruc ?? '');
  const [legalName, setLegalName] = useState(issuer?.legalName ?? '');
  const [tradeName, setTradeName] = useState(issuer?.tradeName ?? '');
  const [address, setAddress] = useState(issuer?.headOfficeAddress ?? '');
  const [accounting, setAccounting] = useState(issuer?.accountingRequired ?? false);
  const [special, setSpecial] = useState(issuer?.specialTaxpayerCode ?? '');
  const [withholding, setWithholding] = useState(issuer?.withholdingAgentCode ?? '');
  const [rimpe, setRimpe] = useState<RimpeRegime>(issuer?.rimpeRegime ?? 'NONE');
  const [environment, setEnvironment] = useState<InvoicingEnvironment>(issuer?.environment ?? '1');
  const [active, setActive] = useState(issuer?.active ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function validate() {
    if (!/^\d{10}001$/.test(ruc.trim())) return 'El RUC debe tener 13 dígitos y terminar en 001.';
    if (!legalName.trim()) return 'Ingresa la razón social.';
    if (!address.trim()) return 'Ingresa la dirección de la matriz.';
    if (special.trim() && !/^\d{3,13}$/.test(special.trim()))
      return 'El código de contribuyente especial debe tener entre 3 y 13 dígitos.';
    if (withholding.trim() && !/^\d{1,8}$/.test(withholding.trim()))
      return 'El código de agente de retención debe tener hasta 8 dígitos.';
    return '';
  }
  async function save() {
    setMessage('');
    const invalid = validate();
    setError(invalid);
    if (invalid) return;
    setPending(true);
    try {
      const saved = await invoicingApi.saveIssuer(requireTenantId(tenantId), {
        ruc: ruc.trim(),
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || null,
        headOfficeAddress: address.trim(),
        accountingRequired: accounting,
        specialTaxpayerCode: special.trim() || null,
        withholdingAgentCode: withholding.trim() || null,
        rimpeRegime: rimpe,
        environment,
        active,
        ...(issuer ? { revision: issuer.revision } : {}),
      });
      onSaved(saved);
      setRuc(saved.ruc);
      setLegalName(saved.legalName);
      setAddress(saved.headOfficeAddress);
      setMessage('Emisor guardado');
    } catch (error) {
      setError(errorMessage(error, 'No se pudo guardar el emisor.'));
    } finally {
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emisor</CardTitle>
        <CardDescription>
          Datos tributarios del consultorio tal como constan en el RUC del SRI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="issuer-ruc">RUC</Label>
            <Input
              id="issuer-ruc"
              inputMode="numeric"
              maxLength={13}
              value={ruc}
              onChange={(event) => setRuc(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="issuer-legal">Razón social</Label>
            <Input
              id="issuer-legal"
              maxLength={300}
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="issuer-trade">Nombre comercial</Label>
            <Input
              id="issuer-trade"
              maxLength={300}
              value={tradeName}
              onChange={(event) => setTradeName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="issuer-address">Dirección de la matriz</Label>
            <Input
              id="issuer-address"
              maxLength={300}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="issuer-special">Contribuyente especial (código)</Label>
            <Input
              id="issuer-special"
              inputMode="numeric"
              maxLength={13}
              value={special}
              onChange={(event) => setSpecial(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="issuer-withholding">Agente de retención (código)</Label>
            <Input
              id="issuer-withholding"
              inputMode="numeric"
              maxLength={8}
              value={withholding}
              onChange={(event) => setWithholding(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="issuer-rimpe">Régimen RIMPE</Label>
            <select
              id="issuer-rimpe"
              className={selectClass}
              value={rimpe}
              onChange={(event) => setRimpe(event.target.value as RimpeRegime)}
            >
              <option value="NONE">Ninguno</option>
              <option value="EMPRENDEDOR">Emprendedor</option>
              <option value="NEGOCIO_POPULAR" disabled>
                Negocio Popular · Aún no disponible
              </option>
            </select>
          </div>
          <div>
            <Label htmlFor="issuer-environment">Ambiente</Label>
            <select
              id="issuer-environment"
              className={selectClass}
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as InvoicingEnvironment)}
            >
              <option value="1">Pruebas</option>
              <option value="2">Producción</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={accounting}
              onChange={(event) => setAccounting(event.target.checked)}
            />
            Obligado a llevar contabilidad
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Emisor activo
          </label>
        </div>
        {environment === '1' && (
          <p className="text-sm text-muted-foreground">
            En pruebas los comprobantes no tienen validez tributaria.
          </p>
        )}
        <Button type="button" disabled={pending} onClick={() => void save()}>
          Guardar emisor
        </Button>
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
  const [establishment, setEstablishment] = useState(saved?.establishmentCode ?? '');
  const [point, setPoint] = useState(saved?.emissionPointCode ?? '');
  const [address, setAddress] = useState(saved?.establishmentAddress ?? '');
  const [sequential, setSequential] = useState('');
  // Only a value the user typed is sent: the cached current number can be stale.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function save() {
    setMessage('');
    setError('');
    const next: Record<string, string> = {};
    if (!THREE_DIGITS.test(establishment)) next.establishment = 'Debe tener tres dígitos (001).';
    if (!THREE_DIGITS.test(point)) next.point = 'Debe tener tres dígitos (001).';
    if (!address.trim()) next.address = 'Ingresa la dirección del establecimiento.';
    const number = Number(sequential);
    if (sequential && (!Number.isInteger(number) || number < 1 || number > 999999999))
      next.sequential = 'Debe ser un entero entre 1 y 999999999.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    try {
      const result = await invoicingApi.savePoint(requireTenantId(tenantId), branch.id, {
        establishmentCode: establishment,
        emissionPointCode: point,
        establishmentAddress: address.trim(),
        ...(sequential ? { nextSequential: number } : {}),
      });
      onSaved(result);
      setSequential('');
      setMessage('Punto guardado');
    } catch (error) {
      setError(errorMessage(error, 'No se pudo guardar el punto.'));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">{branch.name}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`est-${branch.id}`}>Establecimiento · {branch.name}</Label>
          <Input
            id={`est-${branch.id}`}
            inputMode="numeric"
            maxLength={3}
            placeholder="001"
            value={establishment}
            error={errors.establishment}
            onChange={(event) => setEstablishment(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`point-${branch.id}`}>Punto de emisión · {branch.name}</Label>
          <Input
            id={`point-${branch.id}`}
            inputMode="numeric"
            maxLength={3}
            placeholder="001"
            value={point}
            error={errors.point}
            onChange={(event) => setPoint(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`addr-${branch.id}`}>Dirección del establecimiento · {branch.name}</Label>
          <Input
            id={`addr-${branch.id}`}
            maxLength={300}
            value={address}
            error={errors.address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`seq-${branch.id}`}>Siguiente secuencial · {branch.name}</Label>
          <Input
            id={`seq-${branch.id}`}
            type="number"
            min={1}
            max={999999999}
            placeholder={saved ? `Siguiente: ${saved.nextSequential}` : '1'}
            value={sequential}
            error={errors.sequential}
            onChange={(event) => setSequential(event.target.value)}
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => void save()}
      >
        Guardar punto · {branch.name}
      </Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
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
                key={`${branch.id}-${issuer.revision}`}
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
  const [result, setResult] = useState<IssuerTest>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setPending(true);
    setError('');
    try {
      setResult(await invoicingApi.test(requireTenantId(tenantId)));
    } catch (error) {
      setResult(undefined);
      setError(errorMessage(error, 'No se pudo ejecutar la prueba.'));
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
