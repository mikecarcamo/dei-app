const TEMPERAMENT_MAP = {
  a: 'SANGUINEO',
  b: 'COLERICO',
  c: 'MELANCOLICO',
  d: 'FLEMATICO',
};

const TEMPERAMENT_LABELS = {
  SANGUINEO: 'Sanguíneo',
  COLERICO: 'Colérico',
  MELANCOLICO: 'Melancólico',
  FLEMATICO: 'Flemático',
};

const CONCLUSIONS = {
  SANGUINEO: {
    dominant: {
      strengths: 'Persona extrovertida, sociable, optimista y comunicativa. Se relaciona con facilidad y disfruta el trabajo en equipo.',
      weaknesses: 'Puede ser desorganizado/a, impulsivo/a y tener dificultad para mantener el enfoque en una tarea.',
      recommendation: 'Canalize su energía social hacia proyectos colaborativos. Trabaje en desarrollar disciplina y seguimiento de compromisos.',
    },
    secondary: 'Con rasgos secundarios sanguíneos, muestra carisma y flexibilidad interpersonal.',
  },
  COLERICO: {
    dominant: {
      strengths: 'Persona decidida, líder natural, orientada a resultados y con alta capacidad de iniciativa.',
      weaknesses: 'Puede ser impaciente, dominante y poco sensible a las necesidades emocionales de los demás.',
      recommendation: 'Aproveche su capacidad de liderazgo en roles de dirección. Cultive la escucha activa y la empatía.',
    },
    secondary: 'Con rasgos secundarios coléricos, muestra determinación y orientación práctica.',
  },
  MELANCOLICO: {
    dominant: {
      strengths: 'Persona analítica, perfeccionista, creativa y profundamente comprometida con la calidad.',
      weaknesses: 'Puede ser autocrítico/a en exceso, pesimista o propenso/a a la melancolía.',
      recommendation: 'Utilice su capacidad analítica en roles que requieran precisión. Practique el autocuidado y el pensamiento positivo.',
    },
    secondary: 'Con rasgos secundarios melancólicos, muestra sensibilidad y atención al detalle.',
  },
  FLEMATICO: {
    dominant: {
      strengths: 'Persona paciente, estable, diplomática y equilibrada. Excelente mediador/a en situaciones de tensión.',
      weaknesses: 'Puede ser indeciso/a, poco motivado/a para iniciar cambios o resistente a nuevas propuestas.',
      recommendation: 'Aproveche su estabilidad en roles de soporte y mediación. Trabaje en desarrollar iniciativa y asertividad.',
    },
    secondary: 'Con rasgos secundarios flemáticos, muestra calma y capacidad de escucha.',
  },
};

function calculateTemperament(answers, questions) {
  let scoreA = 0, scoreB = 0, scoreC = 0, scoreD = 0;
  let fortA = 0, fortB = 0, fortC = 0, fortD = 0;

  for (const answer of answers) {
    const letter = answer.selected_letter;
    const q = questions.find(q => q.id === answer.question_id);
    if (letter === 'a') { scoreA++; if (q && q.section === 'FORTALEZAS') fortA++; }
    if (letter === 'b') { scoreB++; if (q && q.section === 'FORTALEZAS') fortB++; }
    if (letter === 'c') { scoreC++; if (q && q.section === 'FORTALEZAS') fortC++; }
    if (letter === 'd') { scoreD++; if (q && q.section === 'FORTALEZAS') fortD++; }
  }

  const scores = [
    { letter: 'a', temp: 'SANGUINEO',    total: scoreA, fort: fortA },
    { letter: 'b', temp: 'COLERICO',     total: scoreB, fort: fortB },
    { letter: 'c', temp: 'MELANCOLICO',  total: scoreC, fort: fortC },
    { letter: 'd', temp: 'FLEMATICO',    total: scoreD, fort: fortD },
  ];

  scores.sort((x, y) => {
    if (y.total !== x.total) return y.total - x.total;
    return y.fort - x.fort;
  });

  const dominant = scores[0];
  const secondary = scores[1];
  const isDominantTie = scores[0].total === scores[1].total && scores[0].fort === scores[1].fort;

  let dominantTemp = isDominantTie
    ? `${TEMPERAMENT_LABELS[dominant.temp]} / ${TEMPERAMENT_LABELS[secondary.temp]} (Empate)`
    : dominant.temp;

  let secondaryTemp = isDominantTie ? null : secondary.temp;

  const conclusion = buildConclusion(dominant.temp, isDominantTie ? secondary.temp : secondary.temp, isDominantTie);

  return {
    score_a: scoreA,
    score_b: scoreB,
    score_c: scoreC,
    score_d: scoreD,
    dominant_temperament: dominantTemp,
    secondary_temperament: secondaryTemp,
    conclusion,
    is_tie: isDominantTie,
  };
}

function buildConclusion(dominant, secondary, isTie) {
  const d = CONCLUSIONS[dominant];
  const s = CONCLUSIONS[secondary];

  let text = '';
  if (isTie) {
    text += `Se observa un empate entre el temperamento ${TEMPERAMENT_LABELS[dominant]} y ${TEMPERAMENT_LABELS[secondary]}.\n\n`;
    text += `Fortalezas combinadas: ${d.dominant.strengths} ${s.dominant.strengths}\n\n`;
    text += `Áreas de mejora: ${d.dominant.weaknesses}\n\n`;
    text += `Recomendación: ${d.dominant.recommendation}`;
  } else {
    text += `Temperamento dominante: ${TEMPERAMENT_LABELS[dominant]}\n`;
    text += `${d.dominant.strengths}\n\n`;
    if (secondary && s) {
      text += `Temperamento secundario: ${TEMPERAMENT_LABELS[secondary]}\n`;
      text += `${s.secondary}\n\n`;
    }
    text += `Áreas de mejora: ${d.dominant.weaknesses}\n\n`;
    text += `Recomendación: ${d.dominant.recommendation}`;
  }

  return text;
}

const BURNOUT_RANGOS = {
  CE: { bajo: [0, 18], medio: [19, 26], alto: [27, 54] },
  DP: { bajo: [0, 5],  medio: [6, 9],   alto: [10, 30] },
  RP: { bajo: [0, 33], medio: [34, 39], alto: [40, 56] },
};

function getBurnoutNivel(subescala, score) {
  const r = BURNOUT_RANGOS[subescala];
  if (score <= r.bajo[1]) return 'BAJO';
  if (score <= r.medio[1]) return 'MEDIO';
  return 'ALTO';
}

function calculateBurnout(answers, questions) {
  let ce = 0, dp = 0, rp = 0;
  const ceItems = [1,2,3,6,8,13,14,16,20];
  const dpItems = [5,10,11,15,22];
  const rpItems = [4,7,9,12,17,18,19,21];

  for (const ans of answers) {
    const q = questions.find(q => q.id === ans.question_id);
    if (!q) continue;
    const val = ans.numeric_value || 0;
    if (ceItems.includes(q.number)) ce += val;
    if (dpItems.includes(q.number)) dp += val;
    if (rpItems.includes(q.number)) rp += val;
  }

  const ceNivel = getBurnoutNivel('CE', ce);
  const dpNivel = getBurnoutNivel('DP', dp);
  const rpNivel = getBurnoutNivel('RP', rp);

  const indicios = (ceNivel === 'ALTO' ? 1 : 0) + (dpNivel === 'ALTO' ? 1 : 0) + (rpNivel === 'BAJO' ? 1 : 0);

  let diagnostico = '';
  if (indicios === 0) {
    diagnostico = 'Sin indicios de Burnout. Los niveles se encuentran dentro de rangos saludables.';
  } else if (indicios === 1) {
    diagnostico = 'Indicios leves de Burnout (1 dimensión afectada). Se recomienda atención preventiva.';
  } else if (indicios === 2) {
    diagnostico = 'Indicios moderados de Burnout (2 dimensiones afectadas). Se recomienda intervención profesional.';
  } else {
    diagnostico = 'Síndrome de Burnout presente (3 dimensiones afectadas). Se requiere atención psicológica urgente.';
  }

  return { burnout_ce: ce, burnout_dp: dp, burnout_rp: rp, burnout_ce_nivel: ceNivel, burnout_dp_nivel: dpNivel, burnout_rp_nivel: rpNivel, burnout_diagnostico: diagnostico };
}

module.exports = { calculateTemperament, calculateBurnout, TEMPERAMENT_LABELS, TEMPERAMENT_MAP, BURNOUT_RANGOS };
