import { describe, expect, it } from 'vitest';
import { describeModule } from './module-labels';

describe('describeModule', () => {
  it('names known modules in Spanish with a description', () => {
    expect(describeModule('psychology.assessments')).toEqual({
      name: 'Evaluaciones psicológicas',
      description: expect.stringMatching(/\S/),
    });
    expect(describeModule('nutrition.assessments').name).toBe('Evaluaciones nutricionales');
    expect(describeModule('dentistry.odontogram').name).toBe('Odontograma');
    expect(describeModule('physiotherapy.exercise-plans').name).toBe('Planes de ejercicios');
    expect(describeModule('physiotherapy.evolution').name).toBe('Evolución de fisioterapia');
    expect(describeModule('nutrition.diet-plans').name).toBe('Planes de alimentación');
    expect(describeModule('psychology.session-notes').name).toBe('Notas de sesión');
  });

  it('names every gynecology module in Spanish', () => {
    const names = [
      'consultation',
      'menstrual-history',
      'gynecologic-history',
      'obstetric-history',
      'contraception',
      'iud-procedure',
      'cytology-hpv',
      'colposcopy',
      'ultrasound',
      'biopsy',
      'menopause',
      'fertility',
    ].map((key) => describeModule(`gynecology.${key}`));

    expect(names.map((label) => label.name)).toEqual([
      'Consulta ginecológica',
      'Historia menstrual',
      'Antecedentes ginecológicos',
      'Antecedentes obstétricos',
      'Anticoncepción',
      'Procedimiento con DIU',
      'Citología y prueba VPH',
      'Colposcopia',
      'Ecografía ginecológica',
      'Biopsia',
      'Climaterio y menopausia',
      'Consulta de fertilidad',
    ]);
    for (const label of names) expect(label.description).toMatch(/\S/);
  });

  it('turns an unknown key into readable text instead of showing the raw key', () => {
    expect(describeModule('laboratory.blood_tests')).toEqual({ name: 'Blood tests' });
    expect(describeModule('imaging.x-ray').name).toBe('X ray');
  });

  it('never returns an empty name', () => {
    expect(describeModule('single').name).toBe('Single');
    expect(describeModule('trailing.').name).toBe('trailing.');
    expect(describeModule('').name).toBe('Módulo sin nombre');
  });
});
