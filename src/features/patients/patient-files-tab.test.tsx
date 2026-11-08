import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import type { PatientFile } from '@/types/clinical';
import { fileProblem, formatBytes, PatientFilesTab } from './patient-files-tab';

const hooks = vi.hoisted(() => ({
  files: { data: [] as unknown[], isError: false, isPending: false, refetch: vi.fn() },
  encounters: [] as unknown[],
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/hooks/usePatientFiles', () => ({
  usePatientFiles: () => hooks.files,
  useUploadPatientFile: () => ({ mutateAsync: hooks.upload, isPending: false }),
  useDownloadPatientFile: () => ({ mutate: hooks.download, isPending: false }),
  useRemovePatientFile: () => ({ mutateAsync: hooks.remove, isPending: false }),
}));
vi.mock('@/hooks/useEncounters', () => ({
  usePatientEncounters: () => ({ data: hooks.encounters }),
}));

const stored = (overrides: Partial<PatientFile> = {}): PatientFile => ({
  id: 'file-1',
  patientId: 'patient-1',
  uploadedById: 'me',
  encounterId: null,
  category: 'EXAMEN',
  fileName: 'hemograma.pdf',
  description: 'Control anual',
  mimeType: 'application/pdf',
  sizeBytes: 204800,
  createdAt: '2026-10-03T15:00:00.000Z',
  uploadedBy: { id: 'me', firstName: 'Carlos', lastName: 'Vera' },
  ...overrides,
});

const pdf = (name = 'hemograma.pdf', size = 2048) => {
  const file = new File(['%PDF-1.7'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};
const choose = (file: File) =>
  fireEvent.change(screen.getByLabelText('Archivo'), { target: { files: [file] } });
const submit = () =>
  act(async () => fireEvent.click(screen.getByRole('button', { name: 'Subir archivo' })));

beforeEach(() => {
  vi.clearAllMocks();
  hooks.files = { data: [], isError: false, isPending: false, refetch: vi.fn() };
  hooks.encounters = [];
  hooks.upload.mockResolvedValue(undefined);
  hooks.remove.mockResolvedValue(undefined);
  useAuthStore.setState({ user: { id: 'me', tenantId: 'tenant-1' } as never });
});

describe('fileProblem', () => {
  it('accepts PDF, JPG and PNG up to 10 MB', () => {
    expect(fileProblem({ type: 'application/pdf', size: 10 * 1024 * 1024 })).toBeNull();
    expect(fileProblem({ type: 'image/jpeg', size: 1 })).toBeNull();
    expect(fileProblem({ type: 'image/png', size: 1 })).toBeNull();
  });

  it('explains why a file cannot be uploaded', () => {
    expect(fileProblem({ type: 'application/zip', size: 1 })).toBe('Solo se aceptan archivos PDF, JPG o PNG.');
    expect(fileProblem({ type: 'application/pdf', size: 10 * 1024 * 1024 + 1 })).toBe('El archivo supera los 10 MB.');
    expect(fileProblem({ type: 'application/pdf', size: 0 })).toBe('El archivo está vacío.');
  });
});

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [204800, '200.0 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('writes %d as %s', (bytes, text) => expect(formatBytes(bytes)).toBe(text));
});

describe('PatientFilesTab', () => {
  it('uploads the chosen file with its type and description', async () => {
    render(<PatientFilesTab patientId="patient-1" />);
    // Nothing can be sent before a file is chosen.
    expect(screen.getByRole('button', { name: 'Subir archivo' })).toBeDisabled();

    const file = pdf();
    choose(file);
    fireEvent.change(screen.getByLabelText('Tipo de archivo'), { target: { value: 'INFORME' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: ' Informe radiológico ' } });
    await submit();

    expect(hooks.upload).toHaveBeenCalledWith({
      file,
      category: 'INFORME',
      description: 'Informe radiológico',
    });
    expect(screen.getByLabelText('Descripción')).toHaveValue('');
  });

  it('refuses a file of another type or over the size limit before calling the API', async () => {
    render(<PatientFilesTab patientId="patient-1" />);

    choose(new File(['x'], 'datos.zip', { type: 'application/zip' }));
    expect(screen.getByText('Solo se aceptan archivos PDF, JPG o PNG.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir archivo' })).toBeDisabled();

    choose(pdf('grande.pdf', 11 * 1024 * 1024));
    expect(screen.getByText('El archivo supera los 10 MB.')).toBeInTheDocument();
    await submit();
    expect(hooks.upload).not.toHaveBeenCalled();
  });

  it('puts the file into the open encounter of the professional', async () => {
    hooks.encounters = [
      { id: 'encounter-other', status: 'OPEN', professionalId: 'someone' },
      { id: 'encounter-1', status: 'OPEN', professionalId: 'me' },
    ];
    render(<PatientFilesTab patientId="patient-1" />);

    expect(screen.getByText('Se guardará dentro de la atención en curso.')).toBeInTheDocument();
    choose(pdf());
    await submit();

    expect(hooks.upload).toHaveBeenCalledWith(expect.objectContaining({ encounterId: 'encounter-1' }));
  });

  it('lists the files and downloads one through the API', () => {
    hooks.files.data = [stored()];
    render(<PatientFilesTab patientId="patient-1" />);

    const row = screen.getByText('hemograma.pdf').closest('li') as HTMLElement;
    expect(within(row).getByText('Examen o resultado')).toBeInTheDocument();
    expect(within(row).getByText('200.0 KB · 03/10/2026 · Carlos Vera')).toBeInTheDocument();
    expect(within(row).getByText('Control anual')).toBeInTheDocument();

    fireEvent.click(within(row).getByRole('button', { name: 'Descargar hemograma.pdf' }));
    expect(hooks.download).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-1' }));
  });

  it('lets only the uploader remove a file, and only with a reason', async () => {
    hooks.files.data = [stored(), stored({ id: 'file-2', fileName: 'ajeno.pdf', uploadedById: 'someone' })];
    render(<PatientFilesTab patientId="patient-1" />);

    expect(screen.queryByRole('button', { name: 'Eliminar ajeno.pdf' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar hemograma.pdf' }));
    const confirm = screen.getByRole('button', { name: 'Eliminar archivo' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Paciente equivocado' } });
    await act(async () => fireEvent.click(confirm));

    expect(hooks.remove).toHaveBeenCalledWith({ fileId: 'file-1', reason: 'Paciente equivocado' });
  });

  it('offers no removal of a file that belongs to a signed encounter', () => {
    hooks.encounters = [
      { id: 'closed', status: 'CLOSED', professionalId: 'me' },
      { id: 'open', status: 'OPEN', professionalId: 'me' },
    ];
    hooks.files.data = [
      stored({ id: 'file-1', fileName: 'firmado.pdf', encounterId: 'closed' }),
      stored({ id: 'file-2', fileName: 'abierto.pdf', encounterId: 'open' }),
    ];
    render(<PatientFilesTab patientId="patient-1" />);

    expect(screen.queryByRole('button', { name: 'Eliminar firmado.pdf' })).not.toBeInTheDocument();
    expect(screen.getByText('En una atención firmada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar abierto.pdf' })).toBeInTheDocument();
  });

  it('says so when there are no files and offers a retry when they cannot be loaded', () => {
    const view = render(<PatientFilesTab patientId="patient-1" />);
    expect(screen.getByText('Aún no hay archivos de este paciente.')).toBeInTheDocument();
    view.unmount();

    hooks.files = { data: [], isError: true, isPending: false, refetch: vi.fn() };
    render(<PatientFilesTab patientId="patient-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(hooks.files.refetch).toHaveBeenCalled();
  });
});
