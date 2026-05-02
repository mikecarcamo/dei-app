const db = require('./database');
const { calculateTemperament } = require('../utils/scoring');

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

const TEMPERAMENTOS = ['SANGUINEO','COLERICO','MELANCOLICO','FLEMATICO'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const questions = db.prepare('SELECT id, number, section FROM questions WHERE test_id = 1 ORDER BY number').all();
const options = db.prepare('SELECT id, question_id, letter, temperament FROM options WHERE question_id IN (SELECT id FROM questions WHERE test_id = 1)').all();

const optsByQuestion = {};
for (const o of options) {
  if (!optsByQuestion[o.question_id]) optsByQuestion[o.question_id] = [];
  optsByQuestion[o.question_id].push(o);
}

const EVENT_ID = 2;
const now = new Date();

let inserted = 0;
for (const nombre of NOMBRES) {
  // Asignar temperamento dominante y secundario aleatorio
  const dominant = pick(TEMPERAMENTOS);
  const rest = TEMPERAMENTOS.filter(t => t !== dominant);
  const secondary = pick(rest);

  // Generar respuestas sesgadas hacia el temperamento dominante
  const answers = [];
  const scores = { SANGUINEO: 0, COLERICO: 0, MELANCOLICO: 0, FLEMATICO: 0 };

  for (const q of questions) {
    const opts = optsByQuestion[q.id];
    if (!opts || opts.length === 0) continue;

    // 50% chance de responder con dominante, 25% secundario, 25% aleatorio
    let chosen;
    const r = Math.random();
    if (r < 0.50) {
      chosen = opts.find(o => o.temperament === dominant) || pick(opts);
    } else if (r < 0.75) {
      chosen = opts.find(o => o.temperament === secondary) || pick(opts);
    } else {
      chosen = pick(opts);
    }
    scores[chosen.temperament] = (scores[chosen.temperament] || 0) + 1;
    answers.push({ question_id: q.id, option_id: chosen.id, letter: chosen.letter, temperament: chosen.temperament });
  }

  // Calcular temperamento real usando calculateTemperament
  const result = calculateTemperament(
    answers.map(a => ({ question_id: a.question_id, selected_letter: a.letter })),
    questions
  );
  const conclusion = result.conclusion;

  // Fecha aleatoria entre 2026-04-01 y 2026-05-08
  const baseDate = new Date('2026-04-01');
  const maxDate = new Date('2026-05-08');
  const randDate = new Date(baseDate.getTime() + Math.random() * (maxDate.getTime() - baseDate.getTime()));
  const submitted_at = randDate.toISOString().replace('T', ' ').slice(0, 19);

  const insertResponse = db.prepare(`
    INSERT INTO responses (event_id, test_id, participant_full_name, score_a, score_b, score_c, score_d,
      dominant_temperament, secondary_temperament, conclusion, submitted_at, annulled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const info = insertResponse.run(
    EVENT_ID, 1, nombre,
    result.score_a, result.score_b, result.score_c, result.score_d,
    result.dominant_temperament, result.secondary_temperament || null,
    conclusion, submitted_at
  );

  const responseId = info.lastInsertRowid;

  const insertAnswer = db.prepare(`
    INSERT INTO response_answers (response_id, question_id, selected_option_id, numeric_value)
    VALUES (?, ?, ?, NULL)
  `);

  for (const a of answers) {
    insertAnswer.run(responseId, a.question_id, a.option_id);
  }

  inserted++;
}

console.log(`Insertados ${inserted} registros para evento ${EVENT_ID}`);
