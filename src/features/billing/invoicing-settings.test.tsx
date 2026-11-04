import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoicingKeys } from '@/hooks/useInvoicing';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type User } from '@/types';
import type { InvoicingIssuer } from '@/types/invoicing';
import { InvoicingSettings } from './invoicing-settings';

vi.mock('@/lib/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({
    data: [
      { id: 'b1', name: 'Principal', isActive: true },
      { id: 'b2', name: 'Cerrada', isActive: false },
    ],
  }),
}));

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const SECRET = 'clave-super-secreta';

function issuer(overrides: Partial<InvoicingIssuer> = {}): InvoicingIssuer {
  return {
    id: 'iss1',
    ruc: '1790012345001',
    legalName: 'Clínica Demo S.A.',
    tradeName: null,
    headOfficeAddress: 'Av. Amazonas N1-23',
    accountingRequired: false,
    specialTaxpayerCode: null,
    withholdingAgentCode: null,
    rimpeRegime: 'NONE',
    environment: '1',
    active: true,
    revision: 3,
    certificate: null,
    points: [],
    ...overrides,
  };
}
const certificate = (overrides = {}) => ({
  subject: 'CN=CLINICA DEMO',
  serial: 'ABC123',
  validTo: inDays(200),
  sha256: 'f'.repeat(64),
  rucVerified: true,
  ...overrides,
});

const testResult = {
  certificateValid: true,
  certificateError: null,
  rucVerified: true,
  sriReachable: true,
};

let client: QueryClient;
function mount(role: UserRole = UserRole.MASTER) {
  useAuthStore.setState({ user: { id: 'u1', role, tenantId: 't1' } as User });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InvoicingSettings />
    </QueryClientProvider>,
  );
}
const serve = (value: InvoicingIssuer | null) =>
  vi.mocked(apiClient.get).mockImplementation(async () => value);

beforeEach(() => {
  vi.resetAllMocks();
  serve(null);
});
afterEach(() => client?.clear());

describe('InvoicingSettings', () => {
  it('saves issuer tax data and environment', async () => {
    vi.mocked(apiClient.put).mockResolvedValue(issuer({ environment: '2' }));
    mount();
    fireEvent.change(await screen.findByLabelText('RUC'), { target: { value: '1790012345001' } });
    fireEvent.change(screen.getByLabelText('Razón social'), {
      target: { value: ' Clínica Demo S.A. ' },
    });
    fireEvent.change(screen.getByLabelText('Dirección de la matriz'), {
      target: { value: 'Av. Amazonas N1-23' },
    });
    fireEvent.change(screen.getByLabelText('Régimen RIMPE'), { target: { value: 'EMPRENDEDOR' } });
    fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('Obligado a llevar contabilidad'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar emisor' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/tenants/t1/invoicing/issuer', {
        ruc: '1790012345001',
        legalName: 'Clínica Demo S.A.',
        tradeName: null,
        headOfficeAddress: 'Av. Amazonas N1-23',
        accountingRequired: true,
        specialTaxpayerCode: null,
        withholdingAgentCode: null,
        rimpeRegime: 'EMPRENDEDOR',
        environment: '2',
        active: true,
      }),
    );
    expect(await screen.findByText('Emisor guardado')).toBeInTheDocument();
  });

  it('sends the loaded revision and offers Negocio Popular only as unavailable', async () => {
    serve(issuer());
    vi.mocked(apiClient.put).mockResolvedValue(issuer({ revision: 4 }));
    mount();
    await screen.findByDisplayValue('Clínica Demo S.A.');
    const option = screen.getByRole('option', { name: /Negocio Popular/ });
    expect(option).toBeDisabled();
    expect(option).toHaveTextContent('Aún no disponible');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar emisor' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        '/tenants/t1/invoicing/issuer',
        expect.objectContaining({ revision: 3, environment: '1' }),
      ),
    );
  });

  it('refuses a RUC that is not 13 digits ending in 001 without calling the API', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('RUC'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText('Dirección de la matriz'), { target: { value: 'Y' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar emisor' }));
    expect(await screen.findByText(/13 dígitos y terminar en 001/)).toBeInTheDocument();
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it('shows every invalid issuer field at once next to its field', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('RUC'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Contribuyente especial (código)'), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByLabelText('Agente de retención (código)'), {
      target: { value: '1a' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar emisor' }));
    expect(
      await screen.findByText('El RUC debe tener 13 dígitos y terminar en 001.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Ingresa la razón social.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa la dirección de la matriz.')).toBeInTheDocument();
    expect(
      screen.getByText('El código de contribuyente especial debe tener entre 3 y 13 dígitos.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El código de agente de retención debe tener hasta 8 dígitos.'),
    ).toBeInTheDocument();
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it('reloads an untouched issuer form when a newer configuration arrives', async () => {
    serve(issuer());
    vi.mocked(apiClient.put).mockResolvedValue(issuer({ revision: 5 }));
    mount();
    await screen.findByDisplayValue('Clínica Demo S.A.');
    act(() => {
      client.setQueryData(
        invoicingKeys.issuer('t1'),
        issuer({ revision: 4, legalName: 'Clínica Nueva', environment: '2' }),
      );
    });
    expect(await screen.findByDisplayValue('Clínica Nueva')).toBeInTheDocument();
    expect(screen.getByLabelText('Ambiente')).toHaveValue('2');
    expect(screen.queryByText(/La configuración del emisor cambió/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar emisor' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        '/tenants/t1/invoicing/issuer',
        expect.objectContaining({ revision: 4, legalName: 'Clínica Nueva', environment: '2' }),
      ),
    );
  });

  it('keeps edits with their old revision when the configuration changed elsewhere', async () => {
    serve(issuer());
    vi.mocked(apiClient.put).mockRejectedValue({
      code: 'INVOICING_CONFIGURATION_CHANGED',
      message: 'La configuración cambió.',
    });
    mount();
    fireEvent.change(await screen.findByLabelText('Razón social'), {
      target: { value: 'Mi edición' },
    });
    act(() => {
      client.setQueryData(
        invoicingKeys.issuer('t1'),
        issuer({ revision: 4, legalName: 'Clínica Nueva', environment: '2' }),
      );
    });
    expect(await screen.findByText(/La configuración del emisor cambió/)).toBeInTheDocument();
    expect(screen.getByLabelText('Razón social')).toHaveValue('Mi edición');
    expect(screen.getByLabelText('Ambiente')).toHaveValue('1');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar emisor' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        '/tenants/t1/invoicing/issuer',
        expect.objectContaining({ revision: 3, legalName: 'Mi edición', environment: '1' }),
      ),
    );
    expect(await screen.findByText('La configuración cambió.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recargar datos del emisor' }));
    expect(await screen.findByDisplayValue('Clínica Nueva')).toBeInTheDocument();
    expect(screen.getByLabelText('Ambiente')).toHaveValue('2');
    expect(screen.queryByText(/La configuración del emisor cambió/)).not.toBeInTheDocument();
    expect(screen.queryByText('La configuración cambió.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar emisor' }));
    await waitFor(() =>
      expect(vi.mocked(apiClient.put).mock.calls[1][1]).toEqual(
        expect.objectContaining({ revision: 4, legalName: 'Clínica Nueva' }),
      ),
    );
  });

  it('uploads the p12 with its password and shows holder, serial and expiry, never the password', async () => {
    serve(issuer());
    const validTo = '2030-05-17T12:00:00.000Z';
    vi.mocked(apiClient.put).mockResolvedValue(issuer({ certificate: certificate({ validTo }) }));
    mount();
    const file = new File([new Uint8Array([1, 2, 3])], 'firma.p12');
    const input = await screen.findByLabelText('Archivo de firma (.p12 o .pfx)');
    expect(input).toHaveAttribute('accept', '.p12,.pfx');
    fireEvent.change(input, { target: { files: [file] } });
    const password = screen.getByLabelText('Contraseña de la firma');
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.change(password, { target: { value: SECRET } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir firma' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    const [url, body, config] = vi.mocked(apiClient.put).mock.calls[0] as [
      string,
      FormData,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('/tenants/t1/invoicing/issuer/certificate');
    expect(body.get('file')).toBe(file);
    expect(body.get('password')).toBe(SECRET);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    expect(await screen.findByText('CN=CLINICA DEMO')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText(new Date(validTo).toLocaleDateString('es-EC'))).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Contraseña de la firma')).toHaveValue(''));
    expect(document.body.innerHTML).not.toContain(SECRET);
    expect(JSON.stringify(client.getQueryCache().getAll().map((q) => q.state.data))).not.toContain(
      SECRET,
    );
    expect(
      client
        .getMutationCache()
        .getAll()
        .map((m) => JSON.stringify(m.state.variables ?? null))
        .join(''),
    ).not.toContain(SECRET);
  });

  it('rejects a file over 50 KB before uploading and keeps the typed password out of the page', async () => {
    serve(issuer());
    mount();
    const big = new File([new Uint8Array(50 * 1024 + 1)], 'firma.p12');
    fireEvent.change(await screen.findByLabelText('Archivo de firma (.p12 o .pfx)'), {
      target: { files: [big] },
    });
    fireEvent.change(screen.getByLabelText('Contraseña de la firma'), { target: { value: SECRET } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir firma' }));
    expect(await screen.findByText('El archivo supera los 50 KB. Revisa que sea la firma .p12.')).toBeInTheDocument();
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it('shows the API error when the certificate is refused and clears the password', async () => {
    serve(issuer());
    vi.mocked(apiClient.put).mockRejectedValue({
      message: 'La contraseña de la firma electrónica no es correcta.',
    });
    mount();
    fireEvent.change(await screen.findByLabelText('Archivo de firma (.p12 o .pfx)'), {
      target: { files: [new File([new Uint8Array([1])], 'firma.pfx')] },
    });
    fireEvent.change(screen.getByLabelText('Contraseña de la firma'), { target: { value: SECRET } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir firma' }));
    expect(
      await screen.findByText('La contraseña de la firma electrónica no es correcta.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña de la firma')).toHaveValue('');
    expect(document.body.innerHTML).not.toContain(SECRET);
  });

  it('asks to save the issuer before uploading a certificate', async () => {
    mount();
    await screen.findByLabelText('RUC');
    expect(screen.getAllByText(/Guarda primero los datos del emisor/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Subir firma' })).toBeDisabled();
  });

  it('warns when the certificate expires within 30 days and when it already expired', async () => {
    serve(issuer({ certificate: certificate({ validTo: inDays(10) }) }));
    const { unmount } = mount();
    expect(await screen.findByText(/La firma vence en 10 días/)).toBeInTheDocument();
    unmount();
    serve(issuer({ certificate: certificate({ validTo: inDays(-2) }) }));
    mount();
    expect(await screen.findByText(/La firma ya venció/)).toBeInTheDocument();
  });

  it('shows no expiry warning for a certificate with time left', async () => {
    serve(issuer({ certificate: certificate() }));
    mount();
    await screen.findByText('CN=CLINICA DEMO');
    expect(screen.queryByText(/vence en/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ya venció/)).not.toBeInTheDocument();
  });

  it('warns when the certificate RUC could not be verified', async () => {
    serve(issuer({ certificate: certificate({ rucVerified: false }) }));
    mount();
    expect(await screen.findByText(/No se pudo verificar que la firma pertenezca/)).toBeInTheDocument();
  });

  it('does not warn about the RUC when it was verified', async () => {
    serve(issuer({ certificate: certificate() }));
    mount();
    await screen.findByText('CN=CLINICA DEMO');
    expect(screen.queryByText(/No se pudo verificar/)).not.toBeInTheDocument();
  });

  it('saves a branch emission point with its next sequential and validates three digits', async () => {
    serve(issuer());
    vi.mocked(apiClient.put).mockResolvedValue({
      branchId: 'b1',
      establishmentCode: '001',
      emissionPointCode: '002',
      establishmentAddress: 'Av. Sucursal 5',
      nextSequential: 15,
    });
    mount();
    fireEvent.change(await screen.findByLabelText('Establecimiento · Principal'), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByLabelText('Punto de emisión · Principal'), {
      target: { value: '000' },
    });
    fireEvent.change(screen.getByLabelText('Dirección del establecimiento · Principal'), {
      target: { value: 'Av. Sucursal 5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto · Principal' }));
    expect(await screen.findAllByText(/tres dígitos/)).toHaveLength(2);
    expect(apiClient.put).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Establecimiento · Principal'), {
      target: { value: '001' },
    });
    fireEvent.change(screen.getByLabelText('Punto de emisión · Principal'), {
      target: { value: '002' },
    });
    fireEvent.change(screen.getByLabelText('Siguiente secuencial · Principal'), {
      target: { value: '15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto · Principal' }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/tenants/t1/branches/b1/emission-point', {
        establishmentCode: '001',
        emissionPointCode: '002',
        establishmentAddress: 'Av. Sucursal 5',
        nextSequential: 15,
      }),
    );
    expect(await screen.findByText('Punto guardado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Establecimiento · Cerrada')).not.toBeInTheDocument();
  });

  it('prefills a saved point and shows the API error when the series is taken', async () => {
    serve(
      issuer({
        points: [
          {
            branchId: 'b1',
            establishmentCode: '001',
            emissionPointCode: '001',
            establishmentAddress: 'Av. Matriz',
            nextSequential: 42,
          },
        ],
      }),
    );
    vi.mocked(apiClient.put).mockRejectedValue({ message: 'Esa serie ya está asignada.' });
    mount();
    const sequential = await screen.findByLabelText('Siguiente secuencial · Principal');
    expect(sequential).toHaveValue(null);
    expect(sequential).toHaveAttribute('placeholder', 'Siguiente: 42');
    expect(screen.getByLabelText('Establecimiento · Principal')).toHaveValue('001');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto · Principal' }));
    expect(await screen.findByText('Esa serie ya está asignada.')).toBeInTheDocument();
    // Address-only save: the possibly stale cached sequential is not resent.
    expect(vi.mocked(apiClient.put).mock.calls[0][1]).toEqual({
      establishmentCode: '001',
      emissionPointCode: '001',
      establishmentAddress: 'Av. Matriz',
    });
    fireEvent.change(sequential, { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto · Principal' }));
    await waitFor(() =>
      expect(vi.mocked(apiClient.put).mock.calls[1][1]).toEqual(
        expect.objectContaining({ nextSequential: 50 }),
      ),
    );
  });

  it('blocks saving a new issuer over one created elsewhere until it is reloaded', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Razón social'), {
      target: { value: 'Mi edición' },
    });
    act(() => {
      client.setQueryData(invoicingKeys.issuer('t1'), issuer());
    });
    expect(await screen.findByText(/La configuración del emisor cambió/)).toBeInTheDocument();
    // Without a loaded revision the API could not refuse the overwrite.
    expect(screen.getByRole('button', { name: 'Guardar emisor' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Recargar datos del emisor' }));
    expect(await screen.findByDisplayValue('Clínica Demo S.A.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar emisor' })).toBeEnabled();
  });

  it('reloads an untouched point when the saved point changes and keeps edits otherwise', async () => {
    const saved = {
      branchId: 'b1',
      establishmentCode: '001',
      emissionPointCode: '001',
      establishmentAddress: 'Av. Matriz',
      nextSequential: 42,
    };
    serve(issuer({ points: [saved] }));
    mount();
    const address = await screen.findByLabelText('Dirección del establecimiento · Principal');
    act(() => {
      client.setQueryData(
        invoicingKeys.issuer('t1'),
        issuer({ points: [{ ...saved, establishmentAddress: 'Av. Nueva 1' }] }),
      );
    });
    await waitFor(() => expect(address).toHaveValue('Av. Nueva 1'));
    expect(screen.queryByText(/Este punto cambió/)).not.toBeInTheDocument();
    fireEvent.change(address, { target: { value: 'Mi dirección' } });
    act(() => {
      client.setQueryData(
        invoicingKeys.issuer('t1'),
        issuer({ points: [{ ...saved, emissionPointCode: '009', establishmentAddress: 'Av. Otra' }] }),
      );
    });
    expect(await screen.findByText(/Este punto cambió/)).toBeInTheDocument();
    expect(screen.getByLabelText('Dirección del establecimiento · Principal')).toHaveValue(
      'Mi dirección',
    );
    expect(screen.getByLabelText('Punto de emisión · Principal')).toHaveValue('001');
    fireEvent.click(screen.getByRole('button', { name: 'Recargar punto · Principal' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Punto de emisión · Principal')).toHaveValue('009'),
    );
    expect(screen.getByLabelText('Dirección del establecimiento · Principal')).toHaveValue(
      'Av. Otra',
    );
    expect(screen.queryByText(/Este punto cambió/)).not.toBeInTheDocument();
  });

  it('clears the test result when the issuer is saved in another environment', async () => {
    serve(issuer({ certificate: certificate() }));
    vi.mocked(apiClient.post).mockResolvedValue(testResult);
    vi.mocked(apiClient.put).mockResolvedValue(
      issuer({ certificate: certificate(), environment: '2', revision: 4 }),
    );
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Probar firma y SRI' }));
    expect(await screen.findByText('SRI: disponible')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ambiente'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar emisor' }));
    expect(await screen.findByText('Emisor guardado')).toBeInTheDocument();
    expect(screen.queryByText('SRI: disponible')).not.toBeInTheDocument();
    expect(screen.queryByText(/Firma electrónica: /)).not.toBeInTheDocument();
  });

  it('clears the test result when the certificate is replaced', async () => {
    serve(issuer({ certificate: certificate() }));
    vi.mocked(apiClient.post).mockResolvedValue(testResult);
    vi.mocked(apiClient.put).mockResolvedValue(
      issuer({ certificate: certificate({ sha256: 'a'.repeat(64) }), revision: 4 }),
    );
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Probar firma y SRI' }));
    expect(await screen.findByText('SRI: disponible')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Archivo de firma (.p12 o .pfx)'), {
      target: { files: [new File([new Uint8Array([1])], 'nueva.p12')] },
    });
    fireEvent.change(screen.getByLabelText('Contraseña de la firma'), { target: { value: SECRET } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir firma' }));
    expect(await screen.findByText('Firma electrónica guardada')).toBeInTheDocument();
    expect(screen.queryByText('SRI: disponible')).not.toBeInTheDocument();
  });

  it('discards a test response started with an older configuration', async () => {
    serve(issuer({ certificate: certificate() }));
    let answer!: (value: unknown) => void;
    vi.mocked(apiClient.post).mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)),
    );
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Probar firma y SRI' }));
    act(() => {
      client.setQueryData(
        invoicingKeys.issuer('t1'),
        issuer({ certificate: certificate(), environment: '2', revision: 4 }),
      );
    });
    await act(async () => answer(testResult));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Probar firma y SRI' })).toBeEnabled(),
    );
    expect(screen.queryByText('SRI: disponible')).not.toBeInTheDocument();
    vi.mocked(apiClient.post).mockResolvedValue({ ...testResult, sriReachable: false });
    fireEvent.click(screen.getByRole('button', { name: 'Probar firma y SRI' }));
    expect(await screen.findByText('SRI: sin respuesta')).toBeInTheDocument();
  });

  it('shows the test result for certificate and SRI', async () => {
    serve(issuer({ certificate: certificate() }));
    vi.mocked(apiClient.post).mockResolvedValue({
      certificateValid: true,
      certificateError: null,
      rucVerified: true,
      sriReachable: true,
    });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Probar firma y SRI' }));
    expect(apiClient.post).toHaveBeenCalledWith('/tenants/t1/invoicing/test');
    expect(await screen.findByText('Firma electrónica: válida')).toBeInTheDocument();
    expect(screen.getByText('RUC de la firma: verificado')).toBeInTheDocument();
    expect(screen.getByText('SRI: disponible')).toBeInTheDocument();
  });

  it('explains a failing certificate and an unreachable SRI', async () => {
    serve(issuer({ certificate: certificate() }));
    vi.mocked(apiClient.post).mockResolvedValue({
      certificateValid: false,
      certificateError: 'CERTIFICATE_RUC_MISMATCH',
      rucVerified: false,
      sriReachable: false,
    });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Probar firma y SRI' }));
    expect(await screen.findByText('Firma electrónica: con problemas')).toBeInTheDocument();
    expect(
      screen.getByText('La firma electrónica pertenece a otro RUC distinto al del emisor.'),
    ).toBeInTheDocument();
    expect(screen.getByText('SRI: sin respuesta')).toBeInTheDocument();
  });

  it.each([UserRole.ASISTENTE, UserRole.PROFESIONAL])('never mounts MASTER queries for %s', (role) => {
    mount(role);
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('RUC')).not.toBeInTheDocument();
  });

  it('shows a clear retry when the configuration cannot be loaded', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ message: 'Sin cifrado configurado' });
    mount();
    expect(await screen.findByText(/Sin cifrado configurado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  });
});
