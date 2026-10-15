'use client';

import { useState } from 'react';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useConsentTemplate,
  useConsentTemplates,
  useCreateConsentTemplate,
  usePublishConsent,
  useSaveConsentDraft,
} from '@/hooks/useConsentTemplates';
import type { ConsentTemplateSummary } from '@/types/treatments';
import { ConsentTemplateEditor } from './consent-template-editor';

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; id: string };

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" className="mb-2 min-h-[44px]" onClick={onClick}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      Consentimientos
    </Button>
  );
}

function CreateTemplateView({ onBack }: { onBack: () => void }) {
  const create = useCreateConsentTemplate();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <BackButton onClick={onBack} />
        <h1 className="text-3xl font-bold">Nueva plantilla de consentimiento</h1>
        <p className="mt-1 text-muted-foreground">
          Se guarda como borrador de la versión 1; publícala para usarla en un tratamiento.
        </p>
      </div>
      <div className="max-w-md">
        <Label htmlFor="template-name" required>
          Nombre de la plantilla
        </Label>
        <Input
          id="template-name"
          className="h-11"
          value={name}
          maxLength={120}
          error={nameError ?? undefined}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(null);
          }}
        />
      </div>
      <ConsentTemplateEditor
        saving={create.isPending}
        onPublish={() => undefined}
        onSaveDraft={(draft) => {
          if (name.trim().length < 2) {
            setNameError('El nombre debe tener al menos 2 caracteres');
            return;
          }
          create.mutate({ name: name.trim(), ...draft }, { onSuccess: onBack });
        }}
      />
    </div>
  );
}

function EditTemplateView({ id, canManage, onBack }: { id: string; canManage: boolean; onBack: () => void }) {
  const templateQuery = useConsentTemplate(id);
  const saveDraft = useSaveConsentDraft(id);
  const publish = usePublishConsent(id);
  const template = templateQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <BackButton onClick={onBack} />
        <h1 className="text-3xl font-bold">{template?.name ?? 'Consentimiento'}</h1>
      </div>
      {templateQuery.isError ? (
        <Alert variant="destructive" title="No se pudo cargar la plantilla">
          <Button variant="outline" size="sm" className="mt-2" onClick={() => templateQuery.refetch()}>
            Reintentar
          </Button>
        </Alert>
      ) : !template ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ConsentTemplateEditor
          key={template.id}
          template={template}
          readOnly={!canManage}
          saving={saveDraft.isPending}
          publishing={publish.isPending}
          onSaveDraft={(draft) => saveDraft.mutate(draft)}
          onPublish={() => publish.mutate(undefined)}
        />
      )}
    </div>
  );
}

function versionBadges(template: ConsentTemplateSummary) {
  const published = template.versions.filter((version) => version.status === 'PUBLISHED');
  const latest = published.length ? Math.max(...published.map((version) => version.version)) : null;
  const hasDraft = template.versions.some((version) => version.status === 'DRAFT');
  return { latest, hasDraft };
}

/** The clinic's consent templates: each change of text is a new version, published to take effect. */
export function ConsentsPage({ canManage }: { canManage: boolean }) {
  const templatesQuery = useConsentTemplates();
  const [view, setView] = useState<View>({ mode: 'list' });
  const toList = () => setView({ mode: 'list' });

  if (view.mode === 'create' && canManage) return <CreateTemplateView onBack={toList} />;
  if (view.mode === 'edit') return <EditTemplateView id={view.id} canManage={canManage} onBack={toList} />;

  const templates = templatesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Consentimientos</h1>
          <p className="mt-1 text-muted-foreground">
            Plantillas de consentimiento informado con versiones; lo ya firmado conserva su texto.
          </p>
        </div>
        {canManage && (
          <Button className="min-h-[44px]" onClick={() => setView({ mode: 'create' })}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva plantilla
          </Button>
        )}
      </div>

      {templatesQuery.isError ? (
        <Alert variant="destructive" title="No se pudieron cargar los consentimientos">
          <Button variant="outline" size="sm" className="mt-2" onClick={() => templatesQuery.refetch()}>
            Reintentar
          </Button>
        </Alert>
      ) : templatesQuery.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no hay plantillas de consentimiento.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {templates.map((template) => {
            const { latest, hasDraft } = versionBadges(template);
            return (
              <li key={template.id}>
                <Card>
                  <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{template.name}</p>
                      <Badge variant={template.isActive ? 'success' : 'secondary'}>
                        {template.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                      <Badge variant="outline">{latest ? `Publicada v${latest}` : 'Sin publicar'}</Badge>
                      {hasDraft && <Badge variant="warning">Borrador pendiente</Badge>}
                    </div>
                    <Button
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => setView({ mode: 'edit', id: template.id })}
                      aria-label={`${canManage ? 'Editar' : 'Ver'} ${template.name}`}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {canManage ? 'Editar' : 'Ver'}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
