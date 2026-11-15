// Instrumentos de tamizaje, puntuación y regla de riesgo determinística.
// La severidad y el riesgo se calculan aquí (código), nunca por la IA.

const FREQ_2W = [
  { value: 0, label: 'Ningún día' },
  { value: 1, label: 'Varios días' },
  { value: 2, label: 'Más de la mitad de los días' },
  { value: 3, label: 'Casi todos los días' },
];

const PCL_SCALE = [
  { value: 0, label: 'Nada' },
  { value: 1, label: 'Un poco' },
  { value: 2, label: 'Moderadamente' },
  { value: 3, label: 'Bastante' },
  { value: 4, label: 'Extremadamente' },
];

const YES_NO = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Sí' },
];

const INSTRUMENTS = {
  PHQ9: {
    code: 'PHQ9',
    name: 'PHQ-9 — Cuestionario de Salud del Paciente (depresión)',
    version: '1.0',
    instructions: 'Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?',
    scale: FREQ_2W,
    questions: [
      'Poco interés o placer en hacer las cosas',
      'Sentirse desanimado/a, deprimido/a o sin esperanza',
      'Dificultad para dormir o mantenerse dormido/a, o dormir demasiado',
      'Sentirse cansado/a o con poca energía',
      'Poco apetito o comer en exceso',
      'Sentirse mal consigo mismo/a, sentir que es un fracaso o que ha decepcionado a su familia o a sí mismo/a',
      'Dificultad para concentrarse en actividades como leer o ver televisión',
      'Moverse o hablar tan lento que otras personas lo han notado, o lo contrario: estar tan inquieto/a que se ha movido mucho más de lo normal',
      'Pensamientos de que estaría mejor muerto/a o de hacerse daño de alguna manera',
    ],
    bands: [
      { min: 0, max: 4, label: 'Mínima' },
      { min: 5, max: 9, label: 'Leve' },
      { min: 10, max: 14, label: 'Moderada' },
      { min: 15, max: 19, label: 'Moderadamente severa' },
      { min: 20, max: 27, label: 'Severa' },
    ],
    max: 27,
  },
  GAD7: {
    code: 'GAD7',
    name: 'GAD-7 — Escala de Ansiedad Generalizada',
    version: '1.0',
    instructions: 'Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?',
    scale: FREQ_2W,
    questions: [
      'Sentirse nervioso/a, ansioso/a o con los nervios de punta',
      'No poder dejar de preocuparse o no poder controlar la preocupación',
      'Preocuparse demasiado por diferentes cosas',
      'Dificultad para relajarse',
      'Estar tan inquieto/a que es difícil permanecer sentado/a',
      'Molestarse o irritarse con facilidad',
      'Sentir miedo, como si algo terrible fuera a pasar',
    ],
    bands: [
      { min: 0, max: 4, label: 'Mínima' },
      { min: 5, max: 9, label: 'Leve' },
      { min: 10, max: 14, label: 'Moderada' },
      { min: 15, max: 21, label: 'Severa' },
    ],
    max: 21,
  },
  PCL5: {
    code: 'PCL5',
    name: 'PCL-5 — Lista de Verificación de Estrés Postraumático',
    version: '1.0',
    instructions: 'En el último mes, ¿cuánto le ha molestado cada uno de estos problemas en relación con una experiencia muy estresante?',
    scale: PCL_SCALE,
    questions: [
      'Recuerdos repetidos, perturbadores e indeseados de la experiencia estresante',
      'Sueños repetidos y perturbadores sobre la experiencia estresante',
      'Sentir o actuar de repente como si la experiencia estresante estuviera ocurriendo de nuevo',
      'Sentirse muy alterado/a cuando algo le recuerda la experiencia estresante',
      'Tener reacciones físicas intensas cuando algo le recuerda la experiencia (palpitaciones, falta de aire, sudoración)',
      'Evitar recuerdos, pensamientos o sentimientos relacionados con la experiencia',
      'Evitar recordatorios externos de la experiencia (personas, lugares, conversaciones, actividades, objetos o situaciones)',
      'Dificultad para recordar partes importantes de la experiencia',
      'Tener creencias negativas intensas sobre sí mismo/a, otras personas o el mundo',
      'Culparse a sí mismo/a o a otros por la experiencia o por lo que pasó después',
      'Tener sentimientos negativos intensos como miedo, horror, enojo, culpa o vergüenza',
      'Perder interés en actividades que antes disfrutaba',
      'Sentirse distante o aislado/a de otras personas',
      'Dificultad para experimentar sentimientos positivos (felicidad, cariño hacia personas cercanas)',
      'Comportamiento irritable, arrebatos de enojo o actuar de forma agresiva',
      'Tomar demasiados riesgos o hacer cosas que podrían causarle daño',
      'Estar en estado de "superalerta", vigilante o en guardia',
      'Sentirse sobresaltado/a o asustarse con facilidad',
      'Dificultad para concentrarse',
      'Dificultad para conciliar o mantener el sueño',
    ],
    bands: [
      { min: 0, max: 30, label: 'Por debajo del punto de corte' },
      { min: 31, max: 32, label: 'En zona de punto de corte' },
      { min: 33, max: 80, label: 'Por encima del punto de corte' },
    ],
    max: 80,
  },
  CSSRS: {
    code: 'CSSRS',
    name: 'C-SSRS — Escala Columbia de Severidad Suicida (tamizaje)',
    version: '1.0',
    instructions: 'Preguntas referidas al último mes, salvo que se indique otro periodo.',
    scale: YES_NO,
    questions: [
      '¿Ha deseado estar muerto/a o poder dormirse y no despertar?',
      '¿Ha tenido realmente pensamientos de quitarse la vida?',
      '¿Ha pensado en cómo podría hacerlo?',
      '¿Ha tenido estos pensamientos con alguna intención de llevarlos a cabo?',
      '¿Ha comenzado a elaborar o ha elaborado los detalles de cómo hacerlo? ¿Tiene intención de llevar a cabo ese plan?',
      '¿Alguna vez ha hecho algo, comenzado a hacer algo o se ha preparado para hacer algo para terminar con su vida?',
      'Si respondió sí a la pregunta anterior: ¿ocurrió en los últimos 3 meses?',
    ],
    max: 7,
  },
};

// Lista blanca de códigos (DSM-5-TR usa la codificación CIE-10-MC).
// Basada en los diagnósticos soportados por knowledge/clinical-mental-health/SKILL.md.
const DSM_WHITELIST = [
  { code: 'F32.0', name: 'Trastorno depresivo mayor, episodio único, leve' },
  { code: 'F32.1', name: 'Trastorno depresivo mayor, episodio único, moderado' },
  { code: 'F32.2', name: 'Trastorno depresivo mayor, episodio único, grave' },
  { code: 'F32.9', name: 'Trastorno depresivo mayor, episodio único, no especificado' },
  { code: 'F33.0', name: 'Trastorno depresivo mayor, recurrente, leve' },
  { code: 'F33.1', name: 'Trastorno depresivo mayor, recurrente, moderado' },
  { code: 'F33.2', name: 'Trastorno depresivo mayor, recurrente, grave' },
  { code: 'F33.9', name: 'Trastorno depresivo mayor, recurrente, no especificado' },
  { code: 'F41.1', name: 'Trastorno de ansiedad generalizada' },
  { code: 'F43.10', name: 'Trastorno de estrés postraumático' },
  { code: 'F43.0', name: 'Trastorno de estrés agudo' },
  { code: 'F31.9', name: 'Trastorno bipolar I, no especificado' },
  { code: 'F31.81', name: 'Trastorno bipolar II' },
  { code: 'F60.3', name: 'Trastorno de la personalidad límite' },
  { code: 'F10.10', name: 'Trastorno por consumo de alcohol, leve' },
  { code: 'F10.20', name: 'Trastorno por consumo de alcohol, moderado/grave' },
  { code: 'F12.10', name: 'Trastorno por consumo de cannabis, leve' },
  { code: 'F12.20', name: 'Trastorno por consumo de cannabis, moderado/grave' },
  { code: 'F19.10', name: 'Trastorno por consumo de otra sustancia, leve' },
  { code: 'F19.20', name: 'Trastorno por consumo de otra sustancia, moderado/grave' },
  { code: 'F42.2', name: 'Trastorno obsesivo-compulsivo' },
  { code: 'F90.0', name: 'TDAH, presentación predominante con falta de atención' },
  { code: 'F90.1', name: 'TDAH, presentación predominante hiperactiva/impulsiva' },
  { code: 'F90.2', name: 'TDAH, presentación combinada' },
  { code: 'F43.20', name: 'Trastorno de adaptación, no especificado' },
  { code: 'F43.21', name: 'Trastorno de adaptación con estado de ánimo deprimido' },
  { code: 'F43.22', name: 'Trastorno de adaptación con ansiedad' },
  { code: 'F43.23', name: 'Trastorno de adaptación con ansiedad mixta y estado de ánimo deprimido' },
];

const DEFAULT_CRISIS_RESOURCES = `Guatemala — en caso de riesgo inminente:
- Emergencias Policía Nacional Civil: 110
- Bomberos Voluntarios: 122 · Bomberos Municipales: 123
- Cruz Roja Guatemalteca: 125
- Acudir a la emergencia del hospital nacional más cercano.
Protocolo: no dejar solo/a al paciente, evaluar plan y acceso a medios, contactar red de apoyo, acordar plan de seguridad y seguimiento en 24-72 horas.`;

function bandFor(inst, score) {
  return (inst.bands || []).find(b => score >= b.min && score <= b.max)?.label || '—';
}

// answers: arreglo de valores numéricos en el orden de las preguntas
function scoreInstrument(code, answers) {
  const inst = INSTRUMENTS[code];
  if (!inst) throw new Error(`Instrumento desconocido: ${code}`);
  if (!Array.isArray(answers) || answers.length !== inst.questions.length) {
    throw new Error(`${inst.name}: se esperaban ${inst.questions.length} respuestas`);
  }
  const allowed = new Set(inst.scale.map(s => s.value));
  const values = answers.map(v => Number(v));
  if (values.some(v => !allowed.has(v))) throw new Error(`${inst.name}: respuesta fuera de escala`);

  if (code === 'CSSRS') {
    const [q1, q2, q3, q4, q5, q6, q6recent] = values;
    let level = 'Sin riesgo identificado';
    if (q4 || q5 || (q6 && q6recent)) level = 'Riesgo alto';
    else if (q3 || q6) level = 'Riesgo moderado';
    else if (q1 || q2) level = 'Riesgo bajo';
    return { code, name: inst.name, answers: values, score: values.slice(0, 6).reduce((a, b) => a + b, 0), max: 6, severity: level };
  }

  const score = values.reduce((a, b) => a + b, 0);
  return { code, name: inst.name, answers: values, score, max: inst.max, severity: bandFor(inst, score) };
}

// Regla determinística de riesgo (se ejecuta antes y aparte de la IA).
function evaluateRisk(results, params = {}) {
  const reasons = [];
  let level = null;
  const raise = (lvl) => {
    const order = { bajo: 1, moderado: 2, alto: 3 };
    if (!level || order[lvl] > order[level]) level = lvl;
  };

  const phq = results.find(r => r.code === 'PHQ9');
  if (phq && phq.answers[8] > 0) {
    reasons.push(`PHQ-9 ítem 9 (pensamientos de muerte o de hacerse daño) = ${phq.answers[8]}`);
    raise(phq.answers[8] >= 2 ? 'alto' : 'moderado');
  }
  const cssrs = results.find(r => r.code === 'CSSRS');
  if (cssrs && cssrs.severity !== 'Sin riesgo identificado') {
    reasons.push(`C-SSRS: ${cssrs.severity}`);
    raise(cssrs.severity === 'Riesgo alto' ? 'alto' : cssrs.severity === 'Riesgo moderado' ? 'moderado' : 'bajo');
  }
  if (params.riesgo_suicida === 'si') { reasons.push('El profesional reporta riesgo suicida'); raise('alto'); }
  if (params.riesgo_homicida === 'si') { reasons.push('El profesional reporta riesgo homicida'); raise('alto'); }

  return { alert: reasons.length > 0, level, reasons };
}

function normalizeCode(c) {
  return String(c || '').trim().toUpperCase();
}

// Valida hipótesis contra la lista blanca. Devuelve { accepted, discarded }.
function filterHypotheses(hypotheses, whitelist = DSM_WHITELIST) {
  const map = new Map(whitelist.map(w => [normalizeCode(w.code), w]));
  const accepted = [];
  const discarded = [];
  for (const h of Array.isArray(hypotheses) ? hypotheses : []) {
    const match = map.get(normalizeCode(h.codigo_cie10)) || map.get(normalizeCode(h.codigo_dsm5));
    if (!match) { discarded.push({ codigo_dsm5: h.codigo_dsm5, codigo_cie10: h.codigo_cie10, nombre: h.nombre }); continue; }
    accepted.push({ ...h, codigo_dsm5: match.code, codigo_cie10: match.code, nombre: match.name });
  }
  return { accepted, discarded };
}

function publicInstruments() {
  return Object.values(INSTRUMENTS).map(({ code, name, version, instructions, scale, questions, bands, max }) => ({
    code, name, version, instructions, scale, questions, bands: bands || null, max,
  }));
}

module.exports = {
  INSTRUMENTS, DSM_WHITELIST, DEFAULT_CRISIS_RESOURCES,
  scoreInstrument, evaluateRisk, filterHypotheses, publicInstruments,
};
