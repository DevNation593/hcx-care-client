import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentsPage } from './consents-page';

const hooks = vi.hoisted(() => ({
  list: { data: [] as unknown[], isPending: false, isError: false, refetch: vi.fn() },
  detail: { data: undefined as unknown, isError: false, refetch: vi.fn() },
  saveDraft: vi.fn(),
  publish: vi.fn(),
  create: vi.fn(),
  retire: vi.fn(),
}));

vi.mock('@/hooks/useConsentTemplates', () => ({
  useConsentTemplates: () => hooks.list,
  useConsentTemplate: () => hooks.detail,
  useSaveConsentDraft: () => ({ mutate: hooks.saveDraft, isPending: false }),
  usePublishConsent: () => ({ mutate: hooks.publish, isPending: false }),
  useCreateConsentTemplate: () => ({ mutate: hooks.create, isPending: false }),
  useRetireConsentVersion: () => ({ mutate: hooks.retire, isPending: false }),
}));

const summary = {
  id: 'tpl-1',
  name: 'Toxina',
  isActive: true,
  versions: [
    { id: 'v-2', version: 2, status: 'DRAFT' },
    { id: 'v-1', version: 1, status: 'PUBLISHED' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  hooks.list = { data: [summary], isPending: false, isError: false, refetch: vi.fn() };
  hooks.detail = {
    data: {
      ...summary,
      versions: [
        { ...summary.versions[0], title: 'Borrador', body: 'Texto {{paciente}}', checksum: 'a'.repeat(64), publishedAt: null, createdAt: '2026-03-01T10:00:00.000Z' },
        { ...summary.versions[1], title: 'Vigente', body: 'Texto', checksum: 'b'.repeat(64), publishedAt: '2026-02-01T10:00:00.000Z', createdAt: '2026-02-01T10:00:00.000Z' },
      ],
    },
    isError: false,
    refetch: vi.fn(),
  };
});

describe('ConsentsPage', () => {
  it('lists the templates with their published version and pending draft', () => {
    render(<ConsentsPage canManage />);
    expect(screen.getByText('Toxina')).toBeInTheDocument();
    expect(screen.getByText('Publicada v1')).toBeInTheDocument();
    expect(screen.getByText('Borrador pendiente')).toBeInTheDocument();
  });

  it('is read only without treatments.manage', () => {
    render(<ConsentsPage canManage={false} />);
    expect(screen.queryByRole('button', { name: 'Nueva plantilla' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver Toxina' }));
    expect(screen.getByTestId('consent-preview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
  });

  it('edits the draft of a template and publishes it', () => {
    render(<ConsentsPage canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Toxina' }));
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador');

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(hooks.publish).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Otro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(hooks.saveDraft).toHaveBeenCalledWith({ title: 'Otro', body: 'Texto {{paciente}}' });
  });

  it('creates a template once it has a name', () => {
    render(<ConsentsPage canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva plantilla' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Consentimiento' } });
    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'Yo, {{paciente}}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(screen.getByText('El nombre debe tener al menos 2 caracteres')).toBeInTheDocument();
    expect(hooks.create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Nombre de la plantilla/), { target: { value: 'Relleno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(hooks.create).toHaveBeenCalledWith(
      { name: 'Relleno', title: 'Consentimiento', body: 'Yo, {{paciente}}' },
      expect.anything(),
    );
  });

  it('retires a published version after confirming', () => {
    render(<ConsentsPage canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Toxina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retirar v1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retirar' }));
    expect(hooks.retire).toHaveBeenCalledWith('v-1');
  });
});
