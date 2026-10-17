import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreatmentVersion } from '@/types/treatments';
import { TreatmentVersionForm } from './treatment-version-form';

const forms = [
  { id: 'form-1', name: 'Ficha estética', versions: [1, 2, 3] },
  { id: 'form-2', name: 'Anamnesis', versions: [1] },
];
const consentVersions = [
  { id: 'cv-1', label: 'Toxina · v2' },
  { id: 'cv-2', label: 'Relleno · v1' },
];

const onSubmit = vi.fn();

function setup(props: Partial<React.ComponentProps<typeof TreatmentVersionForm>> = {}) {
  return render(
    <TreatmentVersionForm forms={forms} consentVersions={consentVersions} onSubmit={onSubmit} {...props} />,
  );
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar versión' }));

beforeEach(() => vi.clearAllMocks());

describe('TreatmentVersionForm', () => {
  it('blocks the submit and asks for the form when the form requirement is on without one', () => {
    setup();
    type(/^Precio/, '40');
    fireEvent.click(screen.getByLabelText('Exige ficha'));
    save();

    expect(screen.getByText('Elige la ficha')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks for the form version once a form is chosen, and for the consent when it is required', () => {
    setup();
    type(/^Precio/, '40');
    fireEvent.click(screen.getByLabelText('Exige ficha'));
    type('Ficha', 'form-1');
    fireEvent.click(screen.getByLabelText('Exige consentimiento'));
    save();

    expect(screen.getByText('Elige la versión de la ficha')).toBeInTheDocument();
    expect(screen.getByText('Elige el consentimiento')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers only the versions of the chosen form', () => {
    setup();
    fireEvent.click(screen.getByLabelText('Exige ficha'));
    type('Ficha', 'form-1');
    const options = Array.from(
      (screen.getByLabelText('Versión de la ficha') as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(options).toEqual(['', '1', '2', '3']);
  });

  it.each([
    ['price', /^Precio/, '-1', 'El precio debe ser 0 o más, con hasta dos decimales'],
    ['price decimals', /^Precio/, '10,999', 'El precio debe ser 0 o más, con hasta dos decimales'],
    ['tax', /^Impuesto/, '101', 'El impuesto debe estar entre 0 y 100'],
    ['duration low', /^Duración/, '4', 'La duración debe ser de 5 a 1440 minutos'],
    ['duration high', /^Duración/, '1441', 'La duración debe ser de 5 a 1440 minutos'],
  ])('rejects an out-of-range %s', (_name, label, value, message) => {
    setup();
    type(/^Precio/, '40');
    type(label, value);
    save();

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the requirements in the API shape, with numbers and not strings', () => {
    setup();
    type(/^Precio/, '12,50');
    type(/^Impuesto/, '15');
    type(/^Duración/, '45');
    fireEvent.click(screen.getByLabelText('Exige ficha'));
    type('Ficha', 'form-1');
    type('Versión de la ficha', '2');
    fireEvent.click(screen.getByLabelText('Exige consentimiento'));
    type('Consentimiento', 'cv-1');
    type(/^Vigencia en días/, '365');
    type('Fotos mínimas antes', '2');
    type('Fotos mínimas después', '1');
    fireEvent.click(screen.getByLabelText('Exige notas para cerrar'));
    save();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      price: 12.5,
      taxRatePercent: 15,
      durationMinutes: 45,
      formDefinitionId: 'form-1',
      formVersion: 2,
      consentTemplateVersionId: 'cv-1',
      requirements: {
        medicalForm: { required: true },
        informedConsent: { required: true, validityDays: 365 },
        photos: { minimumBefore: 2, minimumAfter: 1 },
        clinicalNotes: { requiredForCompletion: true },
      },
    });
  });

  it('accepts a price with a dot and leaves the optional parts empty', () => {
    setup();
    type(/^Precio/, '12.50');
    save();

    expect(onSubmit).toHaveBeenCalledWith({
      price: 12.5,
      taxRatePercent: 0,
      durationMinutes: 30,
      formDefinitionId: null,
      formVersion: null,
      consentTemplateVersionId: null,
      requirements: {
        medicalForm: { required: false },
        informedConsent: { required: false, validityDays: null },
        photos: { minimumBefore: 0, minimumAfter: 0 },
        clinicalNotes: { requiredForCompletion: false },
      },
    });
  });

  it('starts from the version being edited', () => {
    const initial = {
      price: 80,
      taxRatePercent: 12,
      durationMinutes: 60,
      formDefinitionId: 'form-2',
      formVersion: 1,
      consentTemplateVersionId: 'cv-2',
      requirements: {
        medicalForm: { required: true },
        informedConsent: { required: true, validityDays: 30 },
        photos: { minimumBefore: 1, minimumAfter: 0 },
        clinicalNotes: { requiredForCompletion: true },
      },
    } as TreatmentVersion;
    setup({ initial });
    save();

    expect(onSubmit).toHaveBeenCalledWith({
      price: 80,
      taxRatePercent: 12,
      durationMinutes: 60,
      formDefinitionId: 'form-2',
      formVersion: 1,
      consentTemplateVersionId: 'cv-2',
      requirements: initial.requirements,
    });
  });

  it('shows what the API rejected', () => {
    setup({ issues: ['medicalForm.required exige formDefinitionId y formVersion.'] });
    expect(screen.getByText('medicalForm.required exige formDefinitionId y formVersion.')).toBeInTheDocument();
  });

  it('does not submit twice while saving', () => {
    setup({ submitting: true });
    expect(screen.getByRole('button', { name: 'Guardar versión' })).toBeDisabled();
  });

  describe('stored references and the lists they come from', () => {
    const stored = {
      price: 80,
      taxRatePercent: 12,
      durationMinutes: 60,
      formDefinitionId: 'form-gone',
      formVersion: 1,
      consentTemplateVersionId: 'cv-gone',
      requirements: {
        medicalForm: { required: true },
        informedConsent: { required: true, validityDays: null },
        photos: { minimumBefore: 0, minimumAfter: 0 },
        clinicalNotes: { requiredForCompletion: false },
      },
    } as TreatmentVersion;

    it('clears a stored form and consent the lists no longer offer, and asks to choose again', () => {
      setup({ initial: stored });

      expect(screen.getAllByText('La versión anterior ya no está disponible; elige otra.')).toHaveLength(2);
      expect((screen.getByLabelText('Ficha') as HTMLSelectElement).value).toBe('');
      expect((screen.getByLabelText('Consentimiento') as HTMLSelectElement).value).toBe('');

      save();
      expect(screen.getByText('Elige la ficha')).toBeInTheDocument();
      expect(screen.getByText('Elige el consentimiento')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();

      type('Ficha', 'form-1');
      expect(screen.getAllByText('La versión anterior ya no está disponible; elige otra.')).toHaveLength(1);
    });

    it('does not send a stale reference when the requirement is turned off', () => {
      setup({ initial: stored });
      fireEvent.click(screen.getByLabelText('Exige ficha'));
      fireEvent.click(screen.getByLabelText('Exige consentimiento'));
      save();

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ formDefinitionId: null, formVersion: null, consentTemplateVersionId: null }),
      );
    });

    it('does not judge the stored references while the lists load', () => {
      setup({ initial: stored, formsStatus: 'loading', consentsStatus: 'loading' });

      expect(screen.getByText('Cargando las fichas…')).toBeInTheDocument();
      expect(screen.getByText('Cargando los consentimientos…')).toBeInTheDocument();
      expect(screen.queryByText('La versión anterior ya no está disponible; elige otra.')).not.toBeInTheDocument();
      save();
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ formDefinitionId: 'form-gone', consentTemplateVersionId: 'cv-gone' }),
      );
    });

    it('shows an error with a retry when the lists fail to load', () => {
      const retry = vi.fn();
      setup({ formsStatus: 'error', consentsStatus: 'error', onRetryChoices: retry });

      expect(screen.getByText('No se pudieron cargar las fichas')).toBeInTheDocument();
      expect(screen.getByText('No se pudieron cargar los consentimientos')).toBeInTheDocument();
      expect(screen.getByLabelText('Exige ficha')).toBeDisabled();
      fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]);
      expect(retry).toHaveBeenCalled();
    });

    it('tells who has no access to the forms and disables the form requirement', () => {
      setup({ formsStatus: 'forbidden' });

      expect(
        screen.getByText(
          'No tienes acceso al listado de fichas. Pide al titular que configure la ficha de este tratamiento.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Exige ficha')).toBeDisabled();
    });

    it('keeps the stored form when the list is forbidden', () => {
      setup({ initial: { ...stored, consentTemplateVersionId: 'cv-1' }, formsStatus: 'forbidden' });
      save();
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ formDefinitionId: 'form-gone', formVersion: 1, consentTemplateVersionId: 'cv-1' }),
      );
    });
  });
});
