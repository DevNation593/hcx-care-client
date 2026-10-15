import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentTemplate, ConsentTemplateVersion } from '@/types/treatments';
import { ConsentTemplateEditor } from './consent-template-editor';

const version = (over: Partial<ConsentTemplateVersion>): ConsentTemplateVersion => ({
  id: 'v-1',
  tenantId: 't',
  templateId: 'tpl-1',
  version: 1,
  title: 'Consentimiento',
  body: 'Yo, , autorizo.',
  status: 'PUBLISHED',
  checksum: 'abcdef0123456789abcdef',
  publishedAt: '2026-03-02T15:00:00.000Z',
  retiredAt: null,
  createdById: 'u',
  createdAt: '2026-03-01T15:00:00.000Z',
  updatedAt: '2026-03-02T15:00:00.000Z',
  ...over,
});

const template = (versions: ConsentTemplateVersion[]): ConsentTemplate => ({
  id: 'tpl-1',
  tenantId: 't',
  name: 'Toxina',
  isActive: true,
  currentVersion: 1,
  createdAt: '2026-03-01T15:00:00.000Z',
  updatedAt: '2026-03-02T15:00:00.000Z',
  versions,
});

const onSaveDraft = vi.fn();
const onPublish = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('ConsentTemplateEditor', () => {
  it('inserts a variable at the cursor and previews it with a sample value', () => {
    render(<ConsentTemplateEditor onSaveDraft={onSaveDraft} onPublish={onPublish} />);
    const body = screen.getByLabelText('Texto') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: 'Yo, , autorizo.' } });
    body.setSelectionRange(4, 4);
    fireEvent.click(screen.getByRole('button', { name: '{{paciente}}' }));

    expect(body.value).toBe('Yo, {{paciente}}, autorizo.');
    expect(screen.getByTestId('consent-preview')).toHaveTextContent('Yo, María Fernanda Pérez, autorizo.');
  });

  it('offers the five variables of the API', () => {
    render(<ConsentTemplateEditor onSaveDraft={onSaveDraft} onPublish={onPublish} />);
    for (const name of ['paciente', 'identificacion', 'tratamiento', 'profesional', 'fecha']) {
      expect(screen.getByRole('button', { name: `{{${name}}}` })).toBeInTheDocument();
    }
  });

  it('leaves an unknown variable as written in the preview', () => {
    render(<ConsentTemplateEditor onSaveDraft={onSaveDraft} onPublish={onPublish} />);
    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'Hola {{apodo}}' } });
    expect(screen.getByTestId('consent-preview')).toHaveTextContent('Hola {{apodo}}');
  });

  it('disables publishing when there is no draft', () => {
    render(
      <ConsentTemplateEditor template={template([version({})])} onSaveDraft={onSaveDraft} onPublish={onPublish} />,
    );
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled();
  });

  it('publishes the saved draft', () => {
    render(
      <ConsentTemplateEditor
        template={template([version({ id: 'v-2', version: 2, status: 'DRAFT', publishedAt: null }), version({})])}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('asks to save before publishing edits that are not saved', () => {
    render(
      <ConsentTemplateEditor
        template={template([version({ id: 'v-2', version: 2, status: 'DRAFT', publishedAt: null })])}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
      />,
    );
    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'Otro texto' } });
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled();
  });

  it('starts the next draft from the latest text and saves title and body', () => {
    render(
      <ConsentTemplateEditor template={template([version({})])} onSaveDraft={onSaveDraft} onPublish={onPublish} />,
    );
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: ' Nuevo título ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(onSaveDraft).toHaveBeenCalledWith({ title: 'Nuevo título', body: 'Yo, , autorizo.' });
  });

  it('does not save an empty title or body', () => {
    render(<ConsentTemplateEditor onSaveDraft={onSaveDraft} onPublish={onPublish} />);
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
  });

  it('lists each version with its number, status, date and the first 12 characters of the checksum', () => {
    render(
      <ConsentTemplateEditor
        template={template([
          version({ id: 'v-2', version: 2, status: 'DRAFT', publishedAt: null, checksum: 'ffffffffffffeeeeeeee' }),
          version({}),
        ])}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('v2');
    expect(items[0]).toHaveTextContent('Borrador');
    expect(items[0]).toHaveTextContent('ffffffffffff');
    expect(items[0]).not.toHaveTextContent('ffffffffffffe');
    expect(items[1]).toHaveTextContent('v1');
    expect(items[1]).toHaveTextContent('Publicada');
    expect(items[1]).toHaveTextContent('abcdef012345');
    expect(items[1]).not.toHaveTextContent('abcdef0123456');
  });

  it('shows no actions when it is read only', () => {
    render(
      <ConsentTemplateEditor
        readOnly
        template={template([version({})])}
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
    expect(screen.getByTestId('consent-preview')).toBeInTheDocument();
  });

  describe('retiring a version', () => {
    const published = template([version({})]);

    it('confirms before retiring a published version', () => {
      const onRetire = vi.fn();
      render(<ConsentTemplateEditor template={published} onSaveDraft={onSaveDraft} onPublish={onPublish} onRetire={onRetire} />);

      fireEvent.click(screen.getByRole('button', { name: 'Retirar v1' }));
      expect(onRetire).not.toHaveBeenCalled();
      expect(screen.getByText('Retirar la versión 1')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Retirar' }));
      expect(onRetire).toHaveBeenCalledWith('v-1');
      expect(screen.queryByText('Retirar la versión 1')).not.toBeInTheDocument();
    });

    it('cancels without retiring', () => {
      const onRetire = vi.fn();
      render(<ConsentTemplateEditor template={published} onSaveDraft={onSaveDraft} onPublish={onPublish} onRetire={onRetire} />);

      fireEvent.click(screen.getByRole('button', { name: 'Retirar v1' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(onRetire).not.toHaveBeenCalled();
    });

    it('offers it only on published versions and not when read only', () => {
      const versions = [
        version({ id: 'v-3', version: 3, status: 'DRAFT', publishedAt: null }),
        version({ id: 'v-2', version: 2, status: 'RETIRED', retiredAt: '2026-04-10T15:00:00.000Z' }),
        version({}),
      ];
      const { unmount } = render(
        <ConsentTemplateEditor template={template(versions)} onSaveDraft={onSaveDraft} onPublish={onPublish} onRetire={vi.fn()} />,
      );
      expect(screen.getAllByRole('button', { name: /^Retirar v/ })).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Retirar v1' })).toBeInTheDocument();
      const retired = screen.getAllByRole('listitem')[1];
      expect(retired).toHaveTextContent('Retirada');
      expect(retired).toHaveTextContent('10/04/2026');
      unmount();

      render(
        <ConsentTemplateEditor readOnly template={template(versions)} onSaveDraft={onSaveDraft} onPublish={onPublish} onRetire={vi.fn()} />,
      );
      expect(screen.queryByRole('button', { name: /^Retirar v/ })).not.toBeInTheDocument();
    });
  });
});
