export interface ModuleLabel {
  name: string;
  description?: string;
}

// The API identifies modules only by key, so their display names live here.
const MODULE_LABELS: Record<string, ModuleLabel> = {
  'psychology.assessments': { name: 'Evaluaciones psicológicas', description: 'Registro de evaluaciones y pruebas por paciente.' },
  'psychology.assessment': { name: 'Evaluaciones psicológicas', description: 'Registro de evaluaciones y pruebas por paciente.' },
  'psychology.notes': { name: 'Notas de psicología', description: 'Notas de sesión propias de la especialidad.' },
  'psychology.session-notes': { name: 'Notas de sesión', description: 'Notas de cada sesión de psicología.' },
  'psychology.mental-exam': { name: 'Examen mental', description: 'Exploración del estado mental y valoración del riesgo.' },
  'psychology.treatment-plan': { name: 'Plan terapéutico', description: 'Hipótesis, objetivos, intervenciones y próximos pasos.' },
  'psychology.phq9': { name: 'PHQ-9', description: 'Cuestionario de síntomas depresivos con puntaje y alertas.' },
  'psychology.gad7': { name: 'GAD-7', description: 'Escala de ansiedad generalizada con puntaje y alertas.' },
  'nutrition.food-history': { name: 'Historia alimentaria', description: 'Alergias, intolerancias, hábitos y objetivos.' },
  'physiotherapy.assessment': { name: 'Valoración funcional', description: 'Dolor, movilidad, rangos articulares y fuerza.' },
  'dentistry.evolution': { name: 'Evolución odontológica', description: 'Procedimiento realizado en cada atención.' },
  'nutrition.assessments': { name: 'Evaluaciones nutricionales', description: 'Medidas, hábitos y valoración del estado nutricional.' },
  'nutrition.assessment': { name: 'Evaluaciones nutricionales', description: 'Medidas, hábitos y valoración del estado nutricional.' },
  'nutrition.diet': { name: 'Planes de alimentación', description: 'Planes y pautas alimentarias por paciente.' },
  'nutrition.diet-plans': { name: 'Planes de alimentación', description: 'Planes y pautas alimentarias por paciente.' },
  'dentistry.odontogram': { name: 'Odontograma', description: 'Registro del estado de cada pieza dental.' },
  'dentistry.treatments': { name: 'Tratamientos dentales', description: 'Seguimiento de tratamientos realizados y pendientes.' },
  'physiotherapy.evolution': { name: 'Evolución de fisioterapia', description: 'Notas de evolución por sesión.' },
  'physiotherapy.exercise-plans': { name: 'Planes de ejercicios', description: 'Ejercicios indicados y su frecuencia.' },
  'gynecology.consultation': { name: 'Consulta ginecológica', description: 'Motivo, anamnesis, examen físico realizado, evaluación y plan.' },
  'gynecology.menstrual-history': { name: 'Historia menstrual', description: 'Menarquia, FUM con su certeza, ciclo y estado menopáusico.' },
  'gynecology.gynecologic-history': { name: 'Antecedentes ginecológicos', description: 'Patologías, cirugías, tamizajes previos y vacunación contra VPH.' },
  'gynecology.obstetric-history': { name: 'Antecedentes obstétricos', description: 'Un registro por embarazo previo con su resultado.' },
  'gynecology.contraception': { name: 'Anticoncepción', description: 'Método, vigencia, efectos referidos y consejería.' },
  'gynecology.iud-procedure': { name: 'Procedimiento con DIU', description: 'Inserción, retiro o recambio con dispositivo y control.' },
  'gynecology.cytology-hpv': { name: 'Citología y prueba VPH', description: 'Muestra, reporte del laboratorio, revisión y comunicación.' },
  'gynecology.colposcopy': { name: 'Colposcopia', description: 'Indicación, hallazgos, biopsia y plan.' },
  'gynecology.ultrasound': { name: 'Ecografía ginecológica', description: 'Mediciones con unidades, hallazgos e impresión.' },
  'gynecology.biopsy': { name: 'Biopsia', description: 'Muestra, reporte histopatológico y revisión.' },
  'gynecology.menopause': { name: 'Climaterio y menopausia', description: 'Síntomas, factores de riesgo, tratamiento y plan.' },
  'gynecology.fertility': { name: 'Consulta de fertilidad', description: 'Tiempo referido, estudios, evolución y derivación.' },
  'core.tasks': { name: 'Actividades', description: 'Pendientes y seguimiento por paciente.' },
  'core.team': { name: 'Equipo', description: 'Gestión de usuarios del consultorio.' },
  'commercial.export': { name: 'Exportación de datos', description: 'Descarga de la información del consultorio.' },
};

/** Display name for a module key; unknown keys become readable text rather than a raw identifier. */
export function describeModule(moduleKey: string): ModuleLabel {
  const known = MODULE_LABELS[moduleKey];
  if (known) return known;
  if (!moduleKey.trim()) return { name: 'Módulo sin nombre' };

  const segment = moduleKey.slice(moduleKey.lastIndexOf('.') + 1).replace(/[_-]+/g, ' ').trim();
  if (!segment) return { name: moduleKey };
  return { name: segment.charAt(0).toUpperCase() + segment.slice(1) };
}
