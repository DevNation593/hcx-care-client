import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import type { SessionMedia, TreatmentSessionDetail } from '@/types/treatments';
import { PhotosStep } from './photos-step';

// The real hook runs against a mocked HTTP client, so the multipart fields are the real ones.
const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ apiClient: http }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const media = (overrides: Partial<SessionMedia> = {}): SessionMedia => ({
  id: 'media-1',
  treatmentSessionId: 'session-1',
  encounterId: 'enc-1',
  uploadedById: 'user-1',
  phase: 'BEFORE',
  category: 'TREATMENT_BEFORE',
  fileName: 'frente.jpg',
  description: null,
  mimeType: 'image/jpeg',
  sizeBytes: 1000,
  createdAt: '2026-10-15T15:00:00.000Z',
  ...overrides,
});

const session = (overrides: Partial<TreatmentSessionDetail> = {}): TreatmentSessionDetail =>
  ({
    id: 'session-1',
    status: 'CONSENTED',
    policy: {
      medicalForm: { required: false },
      informedConsent: { required: true, validityDays: null },
      photos: { minimumBefore: 1, minimumAfter: 2 },
      clinicalNotes: { requiredForCompletion: false },
    },
    media: [],
    allowedCommands: ['UPLOAD_BEFORE', 'START', 'CANCEL', 'NO_SHOW'],
    timezone: 'America/Guayaquil',
    ...overrides,
  }) as TreatmentSessionDetail;

function renderStep(detail: TreatmentSessionDetail, phase: 'BEFORE' | 'AFTER' = 'BEFORE') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = render(<PhotosStep session={detail} phase={phase} />, { wrapper });
  return {
    ...view,
    update: (next: TreatmentSessionDetail) =>
      view.rerender(<PhotosStep session={next} phase={phase} />),
  };
}

const input = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement;
const pick = (element: HTMLInputElement, file: File) =>
  act(async () => fireEvent.change(element, { target: { files: [file] } }));
const jpg = () => new File(['x'], 'frente.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    tenant: { id: 'tenant-1' } as ReturnType<typeof useAuthStore.getState>['tenant'],
    user: null,
  });
  http.get.mockResolvedValue({});
});

describe('PhotosStep', () => {
  it('takes one JPG or PNG from the camera', () => {
    renderStep(session());

    const field = input(/Agregar foto de antes/);
    expect(field).toHaveAttribute('accept', 'image/jpeg,image/png');
    expect(field).toHaveAttribute('capture', 'environment');
    expect(field).not.toHaveAttribute('multiple');
    expect(field).toBeEnabled();
  });

  it('uploads with phase BEFORE and shows 1 de 1 fotos only once the session reports the photo', async () => {
    http.upload.mockResolvedValue(media());
    const view = renderStep(session());
    expect(screen.getByText('0 de 1 fotos')).toBeInTheDocument();
    const file = jpg();

    await pick(input(/Agregar foto de antes/), file);

    expect(http.upload).toHaveBeenCalledWith(
      '/tenants/tenant-1/treatment-sessions/session-1/media',
      file,
      undefined,
      { phase: 'BEFORE' },
    );
    // No optimistic entry: the list follows the session detail.
    expect(screen.getByText('0 de 1 fotos')).toBeInTheDocument();
    expect(screen.queryByText('frente.jpg')).not.toBeInTheDocument();

    view.update(session({ media: [media()] }));

    expect(screen.getByText('1 de 1 fotos')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Fotos de antes' });
    expect(within(list).getByText('frente.jpg')).toBeInTheDocument();
    // The time is shown in the clinic's zone, named.
    expect(within(list).getByText(/10:00.*America\/Guayaquil/)).toBeInTheDocument();
  });

  it('uploads with phase AFTER against the after minimum and lists only that phase', () => {
    renderStep(
      session({
        status: 'IN_PROGRESS',
        allowedCommands: ['UPLOAD_AFTER', 'COMPLETE', 'CANCEL'],
        media: [media(), media({ id: 'media-2', phase: 'AFTER', fileName: 'despues.png' })],
      }),
      'AFTER',
    );

    expect(screen.getByText('1 de 2 fotos')).toBeInTheDocument();
    expect(screen.getByText('despues.png')).toBeInTheDocument();
    expect(screen.queryByText('frente.jpg')).not.toBeInTheDocument();
    expect(input(/Agregar foto de después/)).toBeEnabled();
  });

  it('shows Opcional when the treatment asks for no minimum', () => {
    renderStep(
      session({
        policy: {
          medicalForm: { required: false },
          informedConsent: { required: false, validityDays: null },
          photos: { minimumBefore: 0, minimumAfter: 0 },
          clinicalNotes: { requiredForCompletion: false },
        },
      }),
    );

    expect(screen.getByText('Opcional')).toBeInTheDocument();
    expect(screen.queryByText(/de 0 fotos/)).not.toBeInTheDocument();
    expect(screen.getByText('Aún no hay fotos de antes.')).toBeInTheDocument();
  });

  it('disables the input and explains why when the phase is not allowed', () => {
    renderStep(session({ allowedCommands: ['START', 'CANCEL'] }), 'AFTER');

    expect(input(/Agregar foto de después/)).toBeDisabled();
    expect(
      screen.getByText('Las fotos de después se habilitan cuando se inicia el procedimiento.'),
    ).toBeInTheDocument();
  });

  it('explains that photos of before are over once the procedure started', () => {
    renderStep(
      session({ status: 'IN_PROGRESS', allowedCommands: ['UPLOAD_AFTER', 'COMPLETE', 'CANCEL'] }),
    );

    expect(input(/Agregar foto de antes/)).toBeDisabled();
    expect(screen.getByText('Esta atención ya no admite fotos de antes.')).toBeInTheDocument();
  });

  it.each([
    [400, 'La imagen no es un JPG o PNG válido'],
    [409, 'Esta etapa ya no admite fotos'],
    [413, 'Alcanzaste el límite de almacenamiento'],
  ])('shows the message of a %i and lets the same file be sent again', async (status, message) => {
    http.upload.mockRejectedValueOnce({ status, message });
    renderStep(session());

    await pick(input(/Agregar foto de antes/), jpg());

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('frente.jpg')).not.toBeInTheDocument();
    expect(input(/Agregar foto de antes/)).toBeEnabled();

    http.upload.mockResolvedValueOnce(media());
    await pick(input(/Agregar foto de antes/), jpg());
    expect(http.upload).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  describe('the file input', () => {
    // jsdom lets a file input keep no value, so the reset is observed through the setter.
    const watchValue = (element: HTMLInputElement) => {
      const writes: string[] = [];
      Object.defineProperty(element, 'value', {
        configurable: true,
        get: () => '',
        set: (value: string) => void writes.push(value),
      });
      return writes;
    };

    it('is cleared after an upload so the same photo can be taken again', async () => {
      http.upload.mockResolvedValue(media());
      renderStep(session());
      const field = input(/Agregar foto de antes/);
      const writes = watchValue(field);

      await pick(field, jpg());

      expect(writes).toEqual(['']);
    });

    it('is cleared after a failed upload too', async () => {
      http.upload.mockRejectedValue({ status: 413, message: 'Sin espacio' });
      renderStep(session());
      const field = input(/Agregar foto de antes/);
      const writes = watchValue(field);

      await pick(field, jpg());

      expect(writes).toEqual(['']);
    });

    it('is disabled while a photo uploads and a second photo chosen meanwhile is ignored', async () => {
      let finish!: (value: SessionMedia) => void;
      http.upload.mockReturnValue(new Promise<SessionMedia>((resolve) => (finish = resolve)));
      renderStep(session());
      const field = input(/Agregar foto de antes/);
      const writes = watchValue(field);

      await pick(field, jpg());

      await waitFor(() => expect(field).toBeDisabled());
      expect(screen.getByText('Guardando la foto…')).toBeInTheDocument();
      await pick(field, new File(['y'], 'otra.jpg', { type: 'image/jpeg' }));
      expect(http.upload).toHaveBeenCalledTimes(1);
      // The ignored choice must not clear the input of the upload in flight.
      expect(writes).toEqual([]);

      await act(async () => finish(media()));

      await waitFor(() => expect(field).toBeEnabled());
      expect(writes).toEqual(['']);
      expect(screen.queryByText('Guardando la foto…')).not.toBeInTheDocument();
    });
  });
});
