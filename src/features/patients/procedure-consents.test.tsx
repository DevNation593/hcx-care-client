import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { ProcedureConsents } from './procedure-consents';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  templates: vi.fn(),
  present: vi.fn(),
  sign: vi.fn(),
  refuse: vi.fn(),
}));

vi.mock('@/lib/api/endpoints', () => ({
  procedureConsentsApi: {
    list: api.list,
    templates: api.templates,
    present: api.present,
    sign: api.sign,
    refuse: api.refuse,
    revoke: vi.fn(),
    pdf: vi.fn(),
  },
}));
vi.mock('@/hooks/usePatients', () => ({
  usePatient: () => ({
    data: {
      id: 'patient-1',
      firstName: 'Lucía',
      lastName: 'Benítez',
      dateOfBirth: '1990-05-10',
      identificationNumber: '0102030405',
    },
  }),
}));
// The canvas is not available in tests: a stand-in that "draws" a signature.
vi.mock('@/features/clinical-forms/signature-pad', () => ({
  SignaturePad: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange('data:image/png;base64,iVBORw0KGgo=')}>
      Dibujar firma
    </button>
  ),
}));

const render$ = (openEncounterId?: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProcedureConsents patientId="patient-1" openEncounterId={openEncounterId} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: 'me', role: 'PROFESIONAL', tenantId: 'tenant-1' } as never });
  api.list.mockResolvedValue([]);
  api.templates.mockResolvedValue([
    { templateId: 'tpl-1', name: 'Inserción de DIU', versionId: 'v1', version: 2, title: 'Consentimiento' },
  ]);
});

describe('ProcedureConsents', () => {
  it('is taken only inside an open encounter', async () => {
    render$();
    expect(screen.queryByRole('button', { name: /Tomar consentimiento/ })).not.toBeInTheDocument();
    expect(screen.getByText(/dentro de una atención abierta/)).toBeInTheDocument();
  });

  it('presents the template for the procedure and records the signature with its witness', async () => {
    api.present.mockResolvedValue({
      id: 'doc-1',
      title: 'Consentimiento para Inserción de DIU',
      body: 'Yo, Lucía Benítez, autorizo…',
      status: 'PRESENTED',
      events: [],
    });
    api.sign.mockResolvedValue({ id: 'doc-1', status: 'SIGNED' });
    render$('encounter-1');

    fireEvent.click(screen.getByRole('button', { name: /Tomar consentimiento/ }));
    const dialog = screen.getByRole('dialog');
    await screen.findByRole('option', { name: /Inserción de DIU \(versión 2\)/ });
    fireEvent.change(within(dialog).getByLabelText('Plantilla'), { target: { value: 'tpl-1' } });
    fireEvent.change(within(dialog).getByLabelText('Procedimiento'), {
      target: { value: 'Inserción de DIU de cobre' },
    });
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Mostrar al paciente' })));
    expect(api.present).toHaveBeenCalledWith('patient-1', 'encounter-1', {
      templateId: 'tpl-1',
      procedureName: 'Inserción de DIU de cobre',
    });

    expect(screen.getByText('Yo, Lucía Benítez, autorizo…')).toBeInTheDocument();
    // Procedures take no photos for advertising.
    expect(screen.queryByLabelText(/uso publicitario/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/comprendí/));
    fireEvent.click(screen.getByLabelText(/preguntas/));
    fireEvent.change(screen.getByLabelText(/Testigo/), { target: { value: 'Enfermera de turno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dibujar firma' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Firmar' })));

    expect(api.sign).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({
        signerRole: 'PATIENT',
        signerName: 'Lucía Benítez',
        signerIdentification: '0102030405',
        witnessName: 'Enfermera de turno',
        understood: true,
        questionsAnswered: true,
      }),
    );
    expect(api.sign.mock.calls[0][1]).not.toHaveProperty('marketingPhotos');
  });

  it('lists the consents with their decision and the reason of a refusal', async () => {
    api.list.mockResolvedValue([
      {
        id: 'doc-2',
        procedureName: 'Biopsia de cérvix',
        title: 'Consentimiento',
        status: 'REFUSED',
        presentedAt: '2026-11-08T15:00:00.000Z',
        refusedAt: '2026-11-08T15:05:00.000Z',
        signedAt: null,
        hasPdf: false,
        signature: null,
        encounter: { professionalId: 'me' },
        templateVersion: { version: 1, template: { name: 'Biopsia' } },
        events: [{ type: 'REFUSED', reason: 'Prefiere pensarlo.' }],
      },
    ]);
    render$();

    expect(await screen.findByText('Biopsia de cérvix')).toBeInTheDocument();
    expect(screen.getByText('Rechazado')).toBeInTheDocument();
    expect(screen.getByText('Motivo: Prefiere pensarlo.')).toBeInTheDocument();
  });
});
