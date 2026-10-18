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
  InvoicingOptions,
  SaveConnectionInput,
  Taxpayer,
} from '@/types/invoicing';

const selectClass = 'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

function BranchPoint({
  branch,
  taxpayer,
  saved,
  onSaved,
}: {
  branch: { id: string; name: string };
  taxpayer: InvoicingOptions['taxpayers'][number];
  saved?: EmissionPoint;
  onSaved: () => void;
}) {
  const tenantId = useTenantId();
  const [establishment, setEstablishment] = useState<string>();
  const [point, setPoint] = useState<string>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const establishmentId = establishment ?? saved?.establishmentId ?? '';
  const emissionPointId = point ?? saved?.emissionPointId ?? '';
  const selected = taxpayer.establishments.find((item) => item.id === establishmentId);
  const enabledPoints = selected?.emissionPoints.filter((item) => item.enabled) ?? [];
  const valid = enabledPoints.some((item) => item.id === emissionPointId);
  async function save() {
    setPending(true);
    setError('');
    setMessage('');
    try {
      await invoicingApi.savePoint(requireTenantId(tenantId), branch.id, {
        establishmentId,
        emissionPointId,
      });
      setMessage('Punto guardado');
      onSaved();
    } catch (error) {
      setError((error as ApiError).message || 'No se pudo guardar el punto.');
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
          <select
            id={`est-${branch.id}`}
            className={selectClass}
            value={establishmentId}
            onChange={(event) => {
              setEstablishment(event.target.value);
              setPoint('');
              setMessage('');
            }}
          >
            <option value="">Selecciona un establecimiento</option>
            {taxpayer.establishments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.address}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`point-${branch.id}`}>Punto de emisión · {branch.name}</Label>
          <select
            id={`point-${branch.id}`}
            className={selectClass}
            value={emissionPointId}
            disabled={!selected}
            onChange={(event) => {
              setPoint(event.target.value);
              setMessage('');
            }}
          >
            <option value="">Selecciona un punto</option>
            {enabledPoints.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!valid || pending}
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

function SettingsForm() {
  const tenantId = useTenantId();
  const client = useQueryClient();
  const branches = useBranches();
  const connectionQuery = useQuery({
    queryKey: invoicingKeys.connection(tenantId),
    queryFn: () => invoicingApi.connection(requireTenantId(tenantId)),
    enabled: !!tenantId,
  });
  const connection = connectionQuery.data;
  const optionsQuery = useQuery({
    queryKey: invoicingKeys.options(tenantId),
    queryFn: () => invoicingApi.options(requireTenantId(tenantId)),
    enabled: !!tenantId && !!connection,
  });
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [removeWebhook, setRemoveWebhook] = useState(false);
  const [testedTaxpayers, setTestedTaxpayers] = useState<Taxpayer[]>();
  const [taxpayerId, setTaxpayerId] = useState<string>();
  const [active, setActive] = useState<boolean>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const keyRevision = useRef(0);
  const taxpayers = testedTaxpayers ?? (apiKey ? [] : (optionsQuery.data?.taxpayers ?? []));
  const selectedId = taxpayerId ?? connection?.taxpayerId ?? '';
  const selected = taxpayers.find((item) => item.id === selectedId);
  const savedTaxpayer = optionsQuery.data?.taxpayers.find(
    (item) => item.id === connection?.taxpayerId,
  );
  const environment =
    selected?.defaultEnvironment ?? (!apiKey ? connection?.environment : undefined);
  async function test() {
    const revision = keyRevision.current;
    setPending(true);
    setError('');
    setMessage('');
    try {
      const result = await invoicingApi.test(requireTenantId(tenantId), apiKey || undefined);
      if (revision === keyRevision.current) {
        setTestedTaxpayers(result.taxpayers);
        setMessage('Conexión verificada. Selecciona el emisor y guarda para aplicar.');
      }
    } catch (error) {
      if (revision === keyRevision.current)
        setError((error as ApiError).message || 'No se pudo probar la conexión.');
    } finally {
      setPending(false);
    }
  }
  async function save() {
    setPending(true);
    setError('');
    setMessage('');
    const input: SaveConnectionInput = {
      taxpayerId: selectedId,
      active: active ?? connection?.active ?? true,
      ...(apiKey ? { apiKey } : {}),
      ...(removeWebhook ? { webhookSecret: '' } : webhookSecret ? { webhookSecret } : {}),
    };
    try {
      const saved = await invoicingApi.save(requireTenantId(tenantId), input);
      client.setQueryData(invoicingKeys.connection(tenantId), saved);
      void client.invalidateQueries({ queryKey: invoicingKeys.options(tenantId) });
      void client.invalidateQueries({ queryKey: ['orders'] });
      keyRevision.current++;
      setApiKey('');
      setWebhookSecret('');
      setRemoveWebhook(false);
      setTestedTaxpayers(undefined);
      setTaxpayerId(undefined);
      setMessage('Conexión guardada');
    } catch (error) {
      setError((error as ApiError).message || 'No se pudo guardar la conexión.');
    } finally {
      setPending(false);
    }
  }
  if (connectionQuery.isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Cargando configuración…
      </p>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>emite-facil</CardTitle>
        <CardDescription>
          Conecta el emisor y asigna los puntos de emisión por sucursal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connectionQuery.isError && (
          <Alert variant="destructive">
            {(connectionQuery.error as unknown as ApiError).message ||
              'No se pudo cargar la conexión.'}{' '}
            <Button type="button" variant="link" onClick={() => void connectionQuery.refetch()}>
              Reintentar conexión
            </Button>
          </Alert>
        )}
        <div className="max-w-xl space-y-3">
          {connection?.hasApiKey && (
            <p className="text-sm text-muted-foreground">API key guardada</p>
          )}
          <div>
            <Label htmlFor="invoicing-key">API key</Label>
            <Input
              id="invoicing-key"
              type="password"
              autoComplete="new-password"
              maxLength={512}
              value={apiKey}
              onChange={(event) => {
                keyRevision.current++;
                setApiKey(event.target.value);
                setTestedTaxpayers(undefined);
                setTaxpayerId('');
                setMessage('');
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Deja la clave vacía para conservar la guardada. Probar no guarda cambios.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pending || (!apiKey && !connection?.hasApiKey)}
            onClick={() => void test()}
          >
            Probar conexión
          </Button>
          <div>
            <Label htmlFor="invoicing-taxpayer">Emisor</Label>
            <select
              id="invoicing-taxpayer"
              className={selectClass}
              value={selectedId}
              onChange={(event) => setTaxpayerId(event.target.value)}
              disabled={pending}
            >
              <option value="">Selecciona un emisor</option>
              {!selected && connection && !apiKey && (
                <option value={connection.taxpayerId}>{connection.taxpayerName}</option>
              )}
              {taxpayers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.legalName} · {item.ruc}
                </option>
              ))}
            </select>
          </div>
          {environment && (
            <p className="text-sm">
              Ambiente: <strong>{environment === '1' ? 'Pruebas' : 'Producción'}</strong>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            El ambiente se gestiona en emite-facil. Para actualizarlo aquí, vuelve a probar y guarda
            el mismo emisor.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active ?? connection?.active ?? true}
              onChange={(event) => setActive(event.target.checked)}
            />
            Conexión activa
          </label>
          <div>
            <Label htmlFor="invoicing-webhook">Secreto webhook (opcional)</Label>
            <Input
              id="invoicing-webhook"
              type="password"
              autoComplete="new-password"
              value={webhookSecret}
              disabled={removeWebhook}
              onChange={(event) => setWebhookSecret(event.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {connection?.hasWebhookSecret
              ? 'Secreto guardado. Deja el campo vacío para conservarlo.'
              : 'La consulta periódica funciona sin webhook.'}
          </p>
          {connection?.hasWebhookSecret && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={removeWebhook}
                onChange={(event) => setRemoveWebhook(event.target.checked)}
              />
              Quitar secreto webhook
            </label>
          )}
          <Button
            type="button"
            disabled={pending || !selectedId || (!!apiKey && !selected) || connectionQuery.isError}
            onClick={() => void save()}
          >
            Guardar conexión
          </Button>
        </div>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {error && <Alert variant="destructive">{error}</Alert>}
        {connection && (
          <div className="space-y-3 border-t pt-4">
            {connection.webhookUrl ? (
              <div className="space-y-2">
                <p className="break-all text-sm">URL webhook: {connection.webhookUrl}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(connection.webhookUrl!).then(
                      () => setMessage('URL copiada'),
                      () => setError('No se pudo copiar la URL.'),
                    );
                  }}
                >
                  Copiar URL webhook
                </Button>
                <p className="text-sm text-muted-foreground">
                  Registra esta URL manualmente en emite-facil si deseas recibir eventos.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin webhook: los estados se actualizan por consulta periódica.
              </p>
            )}
            <h3 className="font-medium">Puntos por sucursal</h3>
            {(optionsQuery.isPending || branches.isPending) && (
              <p role="status" className="text-sm">
                Cargando puntos…
              </p>
            )}
            {optionsQuery.isError && (
              <Alert variant="destructive">
                {(optionsQuery.error as unknown as ApiError).message ||
                  'No se pudieron cargar los puntos.'}{' '}
                <Button type="button" variant="link" onClick={() => void optionsQuery.refetch()}>
                  Reintentar puntos
                </Button>
              </Alert>
            )}
            {branches.isError && (
              <Alert variant="destructive">
                No se pudieron cargar las sucursales.{' '}
                <Button type="button" variant="link" onClick={() => void branches.refetch()}>
                  Reintentar sucursales
                </Button>
              </Alert>
            )}
            {savedTaxpayer &&
              branches.data
                ?.filter((branch) => branch.isActive)
                .map((branch) => (
                  <BranchPoint
                    key={`${branch.id}-${connection.taxpayerId}-${connection.revision}`}
                    branch={branch}
                    taxpayer={savedTaxpayer}
                    saved={connection.points.find((point) => point.branchId === branch.id)}
                    onSaved={() => {
                      void connectionQuery.refetch();
                      void client.invalidateQueries({ queryKey: ['orders'] });
                    }}
                  />
                ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Restricted settings never mount their queries for a delegated billing user. */
export function InvoicingSettings() {
  const user = useAuthStore((state) => state.user);
  if (!user || !isMasterRole(user.role)) return null;
  return <SettingsForm />;
}
