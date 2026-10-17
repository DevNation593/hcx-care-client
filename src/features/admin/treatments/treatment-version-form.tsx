'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TreatmentVersion, TreatmentVersionInput } from '@/types/treatments';

/** How the lists of forms and consents the selectors need are doing; `forbidden` is a 403. */
export type ChoicesStatus = 'ready' | 'loading' | 'error' | 'forbidden';

export interface TreatmentVersionFormProps {
  initial?: TreatmentVersion;
  forms: { id: string; name: string; versions: number[] }[];
  /** Only PUBLISHED versions of active templates. */
  consentVersions: { id: string; label: string }[];
  onSubmit: (input: TreatmentVersionInput) => void;
  submitting?: boolean;
  /** What the API rejected (400 TREATMENT_REQUIREMENTS_INVALID), as plain texts. */
  issues?: string[];
  formsStatus?: ChoicesStatus;
  consentsStatus?: ChoicesStatus;
  /** Asks again for the lists that failed to load. */
  onRetryChoices?: () => void;
}

const STALE_NOTE = 'La versión anterior ya no está disponible; elige otra.';

const MAX_PRICE = 999999.99;
const MAX_VALIDITY_DAYS = 3650;
const MAX_PHOTOS = 20;

const SELECT_CLASS =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

/** An amount typed as "12,50" or "12.50" with at most two decimals; null when it is not one. */
function parseAmount(text: string): number | null {
  const value = text.trim();
  return /^\d+([.,]\d{1,2})?$/.test(value) ? Number(value.replace(',', '.')) : null;
}

/** A whole number typed in a field; null when it is not one. */
function parseWhole(text: string): number | null {
  const value = text.trim();
  return /^\d+$/.test(value) ? Number(value) : null;
}

function Toggle({
  id,
  label,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className={`flex min-h-[44px] items-center gap-3 text-sm font-medium ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 rounded border-input accent-primary"
      />
      {label}
    </label>
  );
}

/** The price and the requirements of one treatment version; saving makes a new, immutable version. */
export function TreatmentVersionForm({
  initial,
  forms,
  consentVersions,
  onSubmit,
  submitting = false,
  issues = [],
  formsStatus = 'ready',
  consentsStatus = 'ready',
  onRetryChoices,
}: TreatmentVersionFormProps) {
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [tax, setTax] = useState(initial ? String(initial.taxRatePercent) : '0');
  const [duration, setDuration] = useState(initial ? String(initial.durationMinutes) : '30');
  const [formRequired, setFormRequired] = useState(initial?.requirements.medicalForm.required ?? false);
  const [formId, setFormId] = useState(initial?.formDefinitionId ?? '');
  const [formVersion, setFormVersion] = useState(initial?.formVersion != null ? String(initial.formVersion) : '');
  const [consentRequired, setConsentRequired] = useState(initial?.requirements.informedConsent.required ?? false);
  const [consentId, setConsentId] = useState(initial?.consentTemplateVersionId ?? '');
  const [validityDays, setValidityDays] = useState(
    initial?.requirements.informedConsent.validityDays != null
      ? String(initial.requirements.informedConsent.validityDays)
      : '',
  );
  const [minBefore, setMinBefore] = useState(String(initial?.requirements.photos.minimumBefore ?? 0));
  const [minAfter, setMinAfter] = useState(String(initial?.requirements.photos.minimumAfter ?? 0));
  const [notesRequired, setNotesRequired] = useState(initial?.requirements.clinicalNotes.requiredForCompletion ?? false);
  // A version stored before the billing gate existed bills after the clinical close.
  const [billAfterClose, setBillAfterClose] = useState(
    initial?.requirements.billingGate?.requireClinicalCompletion ?? true,
  );
  const [attempted, setAttempted] = useState(false);

  const priceValue = parseAmount(price);
  const taxValue = parseAmount(tax);
  const durationValue = parseWhole(duration);
  const validityValue = validityDays.trim() === '' ? null : parseWhole(validityDays);
  const beforeValue = parseWhole(minBefore);
  const afterValue = parseWhole(minAfter);
  // A stored form or consent that the lists no longer offer (retired, deactivated) is dropped:
  // the user chooses again instead of the old reference being sent unseen.
  const storedForm = forms.find((candidate) => candidate.id === formId);
  const formStale =
    formsStatus === 'ready' &&
    !!initial?.formDefinitionId &&
    formId === initial.formDefinitionId &&
    !storedForm?.versions.includes(Number(formVersion));
  const consentStale =
    consentsStatus === 'ready' &&
    !!initial?.consentTemplateVersionId &&
    consentId === initial.consentTemplateVersionId &&
    !consentVersions.some((version) => version.id === consentId);
  const formChoice = formStale ? '' : formId;
  const formVersionChoice = formStale ? '' : formVersion;
  const consentChoice = consentStale ? '' : consentId;
  const form = forms.find((candidate) => candidate.id === formChoice);

  const errors: Record<string, string> = {};
  if (priceValue === null || priceValue > MAX_PRICE) {
    errors.price = 'El precio debe ser 0 o más, con hasta dos decimales';
  }
  if (taxValue === null || taxValue > 100) errors.tax = 'El impuesto debe estar entre 0 y 100';
  if (durationValue === null || durationValue < 5 || durationValue > 1440) {
    errors.duration = 'La duración debe ser de 5 a 1440 minutos';
  }
  if (formRequired) {
    if (!formChoice) errors.form = 'Elige la ficha';
    else if (
      !formVersionChoice ||
      (formsStatus === 'ready' && !form?.versions.includes(Number(formVersionChoice)))
    ) {
      errors.formVersion = 'Elige la versión de la ficha';
    }
  }
  if (consentRequired) {
    if (!consentChoice) errors.consent = 'Elige el consentimiento';
    if (validityDays.trim() !== '' && (validityValue === null || validityValue < 1 || validityValue > MAX_VALIDITY_DAYS)) {
      errors.validity = `La vigencia debe ser de 1 a ${MAX_VALIDITY_DAYS} días`;
    }
  }
  if (beforeValue === null || beforeValue > MAX_PHOTOS) errors.before = `Usa un número de 0 a ${MAX_PHOTOS}`;
  if (afterValue === null || afterValue > MAX_PHOTOS) errors.after = `Usa un número de 0 a ${MAX_PHOTOS}`;

  const shown = attempted ? errors : {};

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (submitting || Object.keys(errors).length > 0) return;
    onSubmit({
      price: priceValue as number,
      taxRatePercent: taxValue as number,
      durationMinutes: durationValue as number,
      formDefinitionId: formRequired ? formChoice : null,
      formVersion: formRequired ? Number(formVersionChoice) : null,
      consentTemplateVersionId: consentRequired ? consentChoice : null,
      requirements: {
        medicalForm: { required: formRequired },
        informedConsent: {
          required: consentRequired,
          validityDays: consentRequired ? validityValue : null,
        },
        photos: { minimumBefore: beforeValue as number, minimumAfter: afterValue as number },
        clinicalNotes: { requiredForCompletion: notesRequired },
        billingGate: { requireClinicalCompletion: billAfterClose },
      },
    });
  };

  const fieldError = (id: string, message?: string) =>
    message ? (
      <p id={`${id}-error`} className="mt-1 text-sm text-destructive">
        {message}
      </p>
    ) : null;
  const describedBy = (id: string, message?: string) => (message ? `${id}-error` : undefined);

  const retry = onRetryChoices && (
    <Button type="button" variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={onRetryChoices}>
      Reintentar
    </Button>
  );
  /** What replaces a selector while its list is not available; null when it is. */
  const choicesNotice = (status: ChoicesStatus, what: string, forbidden?: string) => {
    if (status === 'loading') return <p className="text-sm text-muted-foreground">Cargando {what}…</p>;
    if (status === 'error') {
      return (
        <Alert variant="destructive" title={`No se pudieron cargar ${what}`}>
          {retry}
        </Alert>
      );
    }
    if (status === 'forbidden') return <Alert variant="warning">{forbidden}</Alert>;
    return null;
  };
  const formsNotice = choicesNotice(
    formsStatus,
    'las fichas',
    'No tienes acceso al listado de fichas. Pide al titular que configure la ficha de este tratamiento.',
  );
  const consentsNotice = choicesNotice(consentsStatus, 'los consentimientos');

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {issues.length > 0 && (
        <Alert variant="destructive" title="El servidor rechazó la versión">
          <ul className="list-disc pl-4">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="tv-price" required>
            Precio
          </Label>
          <Input
            id="tv-price"
            inputMode="decimal"
            className="h-11"
            value={price}
            placeholder="12,50"
            aria-invalid={!!shown.price || undefined}
            aria-describedby={describedBy('tv-price', shown.price)}
            onChange={(event) => setPrice(event.target.value)}
          />
          {fieldError('tv-price', shown.price)}
        </div>
        <div>
          <Label htmlFor="tv-tax" required>
            Impuesto (%)
          </Label>
          <Input
            id="tv-tax"
            inputMode="decimal"
            className="h-11"
            value={tax}
            aria-invalid={!!shown.tax || undefined}
            aria-describedby={describedBy('tv-tax', shown.tax)}
            onChange={(event) => setTax(event.target.value)}
          />
          {fieldError('tv-tax', shown.tax)}
        </div>
        <div>
          <Label htmlFor="tv-duration" required>
            Duración (minutos)
          </Label>
          <Input
            id="tv-duration"
            inputMode="numeric"
            className="h-11"
            value={duration}
            aria-invalid={!!shown.duration || undefined}
            aria-describedby={describedBy('tv-duration', shown.duration)}
            onChange={(event) => setDuration(event.target.value)}
          />
          {fieldError('tv-duration', shown.duration)}
        </div>
      </div>

      <fieldset className="space-y-3 rounded-md border border-input p-4">
        <legend className="px-1 text-sm font-semibold">Requisitos de la sesión</legend>

        <Toggle
          id="tv-form-required"
          label="Exige ficha"
          checked={formRequired}
          disabled={formsStatus === 'forbidden' || formsStatus === 'error'}
          onChange={setFormRequired}
        />
        {(formsNotice && (formRequired || formsStatus !== 'loading')) ? formsNotice : null}
        {formRequired && formsStatus === 'ready' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="tv-form">Ficha</Label>
              <select
                id="tv-form"
                className={SELECT_CLASS}
                value={formChoice}
                aria-invalid={!!shown.form || undefined}
                aria-describedby={describedBy('tv-form', shown.form)}
                onChange={(event) => {
                  setFormId(event.target.value);
                  setFormVersion('');
                }}
              >
                <option value="">Selecciona una ficha</option>
                {forms.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
              {formStale && <p className="mt-1 text-sm text-muted-foreground">{STALE_NOTE}</p>}
              {fieldError('tv-form', shown.form)}
            </div>
            <div>
              <Label htmlFor="tv-form-version">Versión de la ficha</Label>
              <select
                id="tv-form-version"
                className={SELECT_CLASS}
                value={formVersionChoice}
                disabled={!form}
                aria-invalid={!!shown.formVersion || undefined}
                aria-describedby={describedBy('tv-form-version', shown.formVersion)}
                onChange={(event) => setFormVersion(event.target.value)}
              >
                <option value="">Selecciona una versión</option>
                {(form?.versions ?? []).map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
              {fieldError('tv-form-version', shown.formVersion)}
            </div>
          </div>
        )}

        <Toggle
          id="tv-consent-required"
          label="Exige consentimiento"
          checked={consentRequired}
          disabled={consentsStatus === 'error'}
          onChange={setConsentRequired}
        />
        {consentsNotice && (consentRequired || consentsStatus !== 'loading') ? consentsNotice : null}
        {consentRequired && consentsStatus === 'ready' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="tv-consent">Consentimiento</Label>
              <select
                id="tv-consent"
                className={SELECT_CLASS}
                value={consentChoice}
                aria-invalid={!!shown.consent || undefined}
                aria-describedby={describedBy('tv-consent', shown.consent)}
                onChange={(event) => setConsentId(event.target.value)}
              >
                <option value="">Selecciona un consentimiento</option>
                {consentVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.label}
                  </option>
                ))}
              </select>
              {consentStale && <p className="mt-1 text-sm text-muted-foreground">{STALE_NOTE}</p>}
              {fieldError('tv-consent', shown.consent)}
            </div>
            <div>
              <Label htmlFor="tv-validity">Vigencia en días (opcional)</Label>
              <Input
                id="tv-validity"
                inputMode="numeric"
                className="h-11"
                value={validityDays}
                aria-invalid={!!shown.validity || undefined}
                aria-describedby={describedBy('tv-validity', shown.validity)}
                onChange={(event) => setValidityDays(event.target.value)}
              />
              {fieldError('tv-validity', shown.validity)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="tv-before">Fotos mínimas antes</Label>
            <Input
              id="tv-before"
              inputMode="numeric"
              className="h-11"
              value={minBefore}
              aria-invalid={!!shown.before || undefined}
              aria-describedby={describedBy('tv-before', shown.before)}
              onChange={(event) => setMinBefore(event.target.value)}
            />
            {fieldError('tv-before', shown.before)}
          </div>
          <div>
            <Label htmlFor="tv-after">Fotos mínimas después</Label>
            <Input
              id="tv-after"
              inputMode="numeric"
              className="h-11"
              value={minAfter}
              aria-invalid={!!shown.after || undefined}
              aria-describedby={describedBy('tv-after', shown.after)}
              onChange={(event) => setMinAfter(event.target.value)}
            />
            {fieldError('tv-after', shown.after)}
          </div>
        </div>

        <Toggle
          id="tv-notes-required"
          label="Exige notas para cerrar"
          checked={notesRequired}
          onChange={setNotesRequired}
        />
        <Toggle
          id="tv-billing-gate"
          label="Exigir cierre clínico para facturar"
          checked={billAfterClose}
          onChange={setBillAfterClose}
        />
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" className="min-h-[44px] w-full md:w-auto" loading={submitting}>
          Guardar versión
        </Button>
      </div>
    </form>
  );
}
