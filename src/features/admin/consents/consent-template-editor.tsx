'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/utils';
import type { ConsentTemplate, ConsentTemplateVersionStatus } from '@/types/treatments';

export interface ConsentTemplateEditorProps {
  template?: ConsentTemplate;
  onSaveDraft(input: { title: string; body: string }): void;
  onPublish(): void;
  saving?: boolean;
  publishing?: boolean;
  /** Shows the versions and the preview without the actions that change them. */
  readOnly?: boolean;
}

// The variables the API fills in when it presents a consent.
const VARIABLES = ['paciente', 'identificacion', 'tratamiento', 'profesional', 'fecha'] as const;
type Variable = (typeof VARIABLES)[number];

const SAMPLE_VALUES = (): Record<Variable, string> => ({
  paciente: 'María Fernanda Pérez',
  identificacion: '1712345678',
  tratamiento: 'Toxina botulínica',
  profesional: 'Dra. Ana Vega',
  fecha: formatDate(new Date(), "d 'de' MMMM 'de' yyyy"),
});

/** Like the API: only the known names are replaced, a typo stays visible as written. */
function renderSample(text: string): string {
  const values = SAMPLE_VALUES();
  return text.replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (placeholder, name: string) =>
    (VARIABLES as readonly string[]).includes(name) ? values[name as Variable] : placeholder,
  );
}

const STATUS_LABELS: Record<ConsentTemplateVersionStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicada',
  RETIRED: 'Retirada',
};

const STATUS_VARIANTS: Record<ConsentTemplateVersionStatus, 'secondary' | 'success' | 'outline'> = {
  DRAFT: 'secondary',
  PUBLISHED: 'success',
  RETIRED: 'outline',
};

/** Draft text of a consent template, with its variables, a preview and the history of versions. */
export function ConsentTemplateEditor({
  template,
  onSaveDraft,
  onPublish,
  saving = false,
  publishing = false,
  readOnly = false,
}: ConsentTemplateEditorProps) {
  const versions = template?.versions ?? [];
  const draft = versions.find((version) => version.status === 'DRAFT');
  // A new draft starts from the latest text, whichever its status.
  const source = draft ?? versions[0];

  const [title, setTitle] = useState(source?.title ?? '');
  const [body, setBody] = useState(source?.body ?? '');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);

  // Put the caret after the inserted variable once the text has been rendered.
  useLayoutEffect(() => {
    if (caret.current !== null && bodyRef.current) {
      bodyRef.current.focus();
      bodyRef.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [body]);

  const insert = (variable: Variable) => {
    const field = bodyRef.current;
    const start = field?.selectionStart ?? body.length;
    const end = field?.selectionEnd ?? body.length;
    const text = `{{${variable}}}`;
    caret.current = start + text.length;
    setBody(`${body.slice(0, start)}${text}${body.slice(end)}`);
  };

  const valid = title.trim().length >= 2 && body.trim().length > 0;
  // Publishing publishes the saved draft: unsaved edits would be left out.
  const unsaved = !!draft && (draft.title !== title.trim() || draft.body !== body.trim());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label htmlFor="consent-title">Título</Label>
            <Input
              id="consent-title"
              className="h-11"
              value={title}
              maxLength={200}
              readOnly={readOnly}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="consent-body">Texto</Label>
            <Textarea
              id="consent-body"
              ref={bodyRef}
              rows={12}
              value={body}
              maxLength={50000}
              readOnly={readOnly}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          {!readOnly && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Al presentar el consentimiento, estas variables se reemplazan por los datos de la sesión.
                Pulsa una para insertarla donde está el cursor.
              </p>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((variable) => (
                  <Button
                    key={variable}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => insert(variable)}
                  >
                    {`{{${variable}}}`}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Vista previa con datos de ejemplo</p>
          <div data-testid="consent-preview" className="space-y-2 rounded-md border border-input bg-muted/30 p-4">
            <p className="font-semibold">{renderSample(title)}</p>
            <p className="whitespace-pre-wrap text-sm">{renderSample(body)}</p>
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center">
          {unsaved && (
            <p className="text-sm text-muted-foreground sm:mr-auto">Guarda el borrador para poder publicarlo.</p>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            disabled={!valid}
            loading={saving}
            onClick={() => onSaveDraft({ title: title.trim(), body: body.trim() })}
          >
            Guardar borrador
          </Button>
          <Button
            type="button"
            className="min-h-[44px]"
            disabled={!draft || unsaved}
            loading={publishing}
            onClick={onPublish}
          >
            Publicar
          </Button>
        </div>
      )}

      {versions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Versiones</h3>
          <ul className="divide-y rounded-md border border-input">
            {versions.map((version) => (
              <li key={version.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
                <span className="font-medium">v{version.version}</span>
                <Badge variant={STATUS_VARIANTS[version.status]}>{STATUS_LABELS[version.status]}</Badge>
                <span className="text-muted-foreground">
                  {formatDate(version.publishedAt ?? version.createdAt, 'dd/MM/yyyy')}
                </span>
                <code className="text-xs text-muted-foreground" title="Huella del texto">
                  {version.checksum.slice(0, 12)}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
