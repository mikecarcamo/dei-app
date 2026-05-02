require('dotenv').config();
// seed_burnout.js - 70 registros para evento Burnout id=4
const db = require('./database');

console.log('Insertando test Burnout (MBI)...');

db.prepare(`UPDATE tests SET test_type = 'TEMPERAMENTO' WHERE name = 'Test de Personalidad'`).run();

const existing = db.prepare(`SELECT id FROM tests WHERE name = 'Cuestionario Burnout (MBI)'`).get();
if (!existing) {
  db.prepare(`INSERT INTO tests (name, description, active, test_type) VALUES (?, ?, 1, 'BURNOUT')`).run(
    'Cuestionario Burnout (MBI)',
    'Maslach Burnout Inventory (MBI). Mide el síndrome de Burnout en tres dimensiones: Cansancio Emocional, Despersonalización y Realización Personal. Frecuencia: 0=Nunca, 6=Todos los días.'
  );
}

const burnoutTest = db.prepare(`SELECT id FROM tests WHERE name = 'Cuestionario Burnout (MBI)'`).get();
console.log('Test Burnout id:', burnoutTest.id);

const burnoutQuestions = [
  { number: 1,  text: 'Me siento emocionalmente agotado/a por mi trabajo.',                                        subescala: 'CE' },
  { number: 2,  text: 'Me siento cansado al final de la jornada de trabajo.',                                      subescala: 'CE' },
  { number: 3,  text: 'Cuando me levanto por la mañana y me enfrento a otra jornada de trabajo me siento fatigado.', subescala: 'CE' },
  { number: 4,  text: 'Tengo facilidad para comprender como se sienten mis alumnos/as.',                           subescala: 'RP' },
  { number: 5,  text: 'Creo que estoy tratando a algunos alumnos/as como si fueran objetos impersonales.',         subescala: 'DP' },
  { number: 6,  text: 'Siento que trabajar todo el día con alumnos/as supone un gran esfuerzo y me cansa.',        subescala: 'CE' },
  { number: 7,  text: 'Creo que trato con mucha eficacia los problemas de mis alumnos/as.',                       subescala: 'RP' },
  { number: 8,  text: 'Siento que mi trabajo me está desgastando. Me siento quemado por mi trabajo.',             subescala: 'CE' },
  { number: 9,  text: 'Creo que con mi trabajo estoy influyendo positivamente en la vida de mis alumnos/as.',     subescala: 'RP' },
  { number: 10, text: 'Me he vuelto más insensible con la gente desde que ejerzo la profesión docente.',          subescala: 'DP' },
  { number: 11, text: 'Pienso que este trabajo me está endureciendo emocionalmente.',                             subescala: 'DP' },
  { number: 12, text: 'Me siento con mucha energía en mi trabajo.',                                               subescala: 'RP' },
  { number: 13, text: 'Me siento frustrado/a en mi trabajo.',                                                     subescala: 'CE' },
  { number: 14, text: 'Creo que trabajo demasiado.',                                                              subescala: 'CE' },
  { number: 15, text: 'No me preocupa realmente lo que les ocurra a algunos de mis alumnos/as.',                  subescala: 'DP' },
  { number: 16, text: 'Trabajar directamente con alumnos/as me produce estrés.',                                  subescala: 'CE' },
  { number: 17, text: 'Siento que puedo crear con facilidad un clima agradable con mis alumnos/as.',              subescala: 'RP' },
  { number: 18, text: 'Me siento motivado después de trabajar en contacto con alumnos/as.',                       subescala: 'RP' },
  { number: 19, text: 'Creo que consigo muchas cosas valiosas en este trabajo.',                                  subescala: 'RP' },
  { number: 20, text: 'Me siento acabado en mi trabajo, al límite de mis posibilidades.',                         subescala: 'CE' },
  { number: 21, text: 'En mi trabajo trato los problemas emocionalmente con mucha calma.',                        subescala: 'RP' },
  { number: 22, text: 'Creo que los alumnos/as me culpan de algunos de sus problemas.',                           subescala: 'DP' },
];

const existingQ = db.prepare(`SELECT id FROM questions WHERE test_id = ?`).all(burnoutTest.id);
if (existingQ.length === 0) {
  for (const q of burnoutQuestions) {
    db.prepare(`INSERT INTO questions (test_id, number, section, text, active) VALUES (?, ?, ?, ?, 1)`)
      .run(burnoutTest.id, q.number, q.subescala, q.text);
  }
  console.log('22 preguntas Burnout insertadas.');
} else {
  console.log('Preguntas Burnout ya existen, omitiendo.');
}

console.log('=== Seed Burnout completado ===');
console.log('Test ID:', burnoutTest.id);
