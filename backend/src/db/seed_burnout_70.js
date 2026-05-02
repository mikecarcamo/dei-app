const db = require('./database');
const { calculateBurnout } = require('../utils/scoring');

const NOMBRES = [
  'Ana Lucía Martínez','Carlos Eduardo Pérez','María Fernanda López','José Antonio García',
  'Sofía Alejandra Rodríguez','Luis Enrique Hernández','Valeria Cristina Torres','Diego Armando Flores',
  'Gabriela Paola Ramírez','Roberto Carlos Morales','Isabella Renata Castillo','Andrés Felipe Vargas',
  'Daniela Marcela Jiménez','Fernando José Ruiz','Camila Andrea Reyes','Santiago David Núñez',
  'Paola Beatriz Mendoza','Javier Alejandro Cruz','Laura Vanessa Díaz','Eduardo Manuel Ortiz',
  'Natalia Stefanía Ramos','Marco Antonio Vega','Alejandra Cristina Soto','Pedro Pablo Ríos',
  'Verónica Lissette Aguilar','Ricardo Emilio León','Karla Beatriz Pineda','Óscar Augusto Fuentes',
  'Silvia Marisol Guerrero','Héctor Fabián Mendez','Patricia Eugenia Salazar','Rodrigo Arturo Herrera',
  'Lucía Esperanza Domínguez','Miguel Ángel Sandoval','Claudia Leticia Espinoza','Enrique Alberto Mejía',
  'Andrea Fabiola Castellanos','Francisco Javier Gómez','Rebeca Yolanda Molina','Alberto Enrique Portillo',
  'Mariana Gabriela Rosales','Jorge Luis Chávez','Esmeralda Concepción Méndez','Raúl Antonio Bonilla',
  'Yessenia Maribel Ochoa','Sergio Humberto Padilla','Miriam Estela Contreras','Gustavo Adolfo Quiñones',
  'Brenda Carolina Lima','Wilfrido Ernesto Sánchez','Roxana Lourdes Batres','Nelson Iván Leiva',
  'Ingrid Lorena Fuentes','Álvaro Josué Hernández','Karina Vanessa Mazariegos','Byron Rodolfo Ajú',
  'Wendy Marisol Chacón','Hugo Leonel Barrios','Flor de María Acabal','Elder Josué Tello',
  'Cindy Paola Cáceres','Mynor Alexander Pinto','Dulce María Tzoy','Erick Josué Canel',
  'Lesbia Yolanda Coy','Fredy Armando Tzul','Alma Patricia Choc','Marvin Stuardo Xol',
  'Evelyn Beatriz Chub','Ronaldo Josué Tux'
];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const EVENT_ID = 4;
const TEST_ID  = 3;

const questions = db.prepare('SELECT id, number, section FROM questions WHERE test_id = ? ORDER BY number').all(TEST_ID);
if (questions.length === 0) { console.error('No se encontraron preguntas para test_id=3'); process.exit(1); }

// Opciones 0-6 por pregunta (Likert MBI)
const insertResponse = db.prepare(`
  INSERT INTO responses (event_id, test_id, participant_full_name,
    burnout_ce, burnout_dp, burnout_rp,
    burnout_ce_nivel, burnout_dp_nivel, burnout_rp_nivel,
    burnout_diagnostico, submitted_at, annulled)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
`);

const insertAnswer = db.prepare(`
  INSERT INTO response_answers (response_id, question_id, selected_option_id, numeric_value)
  VALUES (?, ?, NULL, ?)
`);

// Perfiles de respuesta para variedad realista
// alto_burnout: CE alto, DP alto, RP bajo
// medio_burnout: mezcla
// sin_burnout: CE bajo, DP bajo, RP alto
function generarValores(perfil) {
  if (perfil === 'alto') {
    return {
      ce: () => randInt(27, 54),  // ALTO
      dp: () => randInt(10, 30),  // ALTO
      rp: () => randInt(0, 33),   // BAJO (riesgo)
    };
  } else if (perfil === 'medio') {
    return {
      ce: () => randInt(19, 30),  // MEDIO/ALTO
      dp: () => randInt(5, 12),   // MEDIO
      rp: () => randInt(30, 42),  // MEDIO
    };
  } else {
    return {
      ce: () => randInt(0, 20),   // BAJO
      dp: () => randInt(0, 6),    // BAJO
      rp: () => randInt(38, 48),  // ALTO (saludable)
    };
  }
}

// Distribuir perfiles: 30% alto, 40% medio, 30% sin burnout
const perfiles = [];
for (let i = 0; i < 70; i++) {
  if (i < 21) perfiles.push('alto');
  else if (i < 49) perfiles.push('medio');
  else perfiles.push('bajo');
}
// Mezclar
perfiles.sort(() => Math.random() - 0.5);

const ceItems = [1,2,3,6,8,13,14,16,20];
const dpItems = [5,10,11,15,22];
const rpItems = [4,7,9,12,17,18,19,21];

let inserted = 0;

for (let i = 0; i < NOMBRES.length; i++) {
  const nombre = NOMBRES[i];
  const perfil = perfiles[i];
  const gen = generarValores(perfil);

  // Generar scores totales por subescala
  const ceTotal = gen.ce();
  const dpTotal = gen.dp();
  const rpTotal = gen.rp();

  // Distribuir scores entre preguntas de cada subescala
  function distribuirEnPreguntas(total, count) {
    const vals = Array(count).fill(0);
    let restante = total;
    for (let j = 0; j < count; j++) {
      const max = Math.min(6, restante);
      const val = j === count - 1 ? Math.min(6, Math.max(0, restante)) : randInt(0, max);
      vals[j] = val;
      restante -= val;
    }
    return vals.map(v => Math.max(0, Math.min(6, v)));
  }

  const ceVals = distribuirEnPreguntas(ceTotal, ceItems.length);
  const dpVals = distribuirEnPreguntas(dpTotal, dpItems.length);
  const rpVals = distribuirEnPreguntas(rpTotal, rpItems.length);

  // Construir mapa número→valor
  const valMap = {};
  ceItems.forEach((n, idx) => valMap[n] = ceVals[idx]);
  dpItems.forEach((n, idx) => valMap[n] = dpVals[idx]);
  rpItems.forEach((n, idx) => valMap[n] = rpVals[idx]);

  // Construir answers para calculateBurnout
  const answers = questions.map(q => ({ question_id: q.id, numeric_value: valMap[q.number] ?? 0 }));
  const result = calculateBurnout(answers, questions);

  const baseDate = new Date('2026-04-01');
  const maxDate  = new Date('2026-05-08');
  const randDate = new Date(baseDate.getTime() + Math.random() * (maxDate.getTime() - baseDate.getTime()));
  const submitted_at = randDate.toISOString().replace('T', ' ').slice(0, 19);

  const info = insertResponse.run(
    EVENT_ID, TEST_ID, nombre,
    result.burnout_ce, result.burnout_dp, result.burnout_rp,
    result.burnout_ce_nivel, result.burnout_dp_nivel, result.burnout_rp_nivel,
    result.burnout_diagnostico, submitted_at
  );

  const responseId = info.lastInsertRowid;
  for (const a of answers) {
    insertAnswer.run(responseId, a.question_id, a.numeric_value);
  }

  inserted++;
}

console.log(`Insertados ${inserted} registros para evento ${EVENT_ID} (Burnout)`);
