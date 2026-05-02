require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

console.log('Ejecutando seed...');

const insertEntity = db.prepare(`
  INSERT OR IGNORE INTO entities (name, description, active) VALUES (?, ?, 1)
`);
insertEntity.run('DEI', 'Entidad principal del sistema');
const entity = db.prepare(`SELECT id FROM entities WHERE name = 'DEI'`).get();
console.log('Entidad DEI creada/verificada, id:', entity.id);

const passwordHash = bcrypt.hashSync('123456789', 12);
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (entity_id, full_name, email, password_hash, role, active, must_change_password)
  VALUES (?, ?, ?, ?, ?, 1, 1)
`);
insertUser.run(entity.id, 'Administrador DEI', 'mikenoecarcamo@gmail.com', passwordHash, 'ADMIN');
const adminUser = db.prepare(`SELECT id FROM users WHERE email = 'mikenoecarcamo@gmail.com'`).get();
console.log('Usuario admin creado/verificado, id:', adminUser.id);

const insertTest = db.prepare(`
  INSERT OR IGNORE INTO tests (name, description, active) VALUES (?, ?, 1)
`);
insertTest.run(
  'Test de Personalidad',
  'Test de temperamentos basado en el modelo de los cuatro temperamentos: Sanguíneo, Colérico, Melancólico y Flemático. Este resultado es orientativo y no constituye diagnóstico psicológico clínico.'
);
const test = db.prepare(`SELECT id FROM tests WHERE name = 'Test de Personalidad'`).get();
console.log('Test creado/verificado, id:', test.id);

const questionsData = [
  { number: 1,  section: 'FORTALEZAS',  text: '1', options: [{ letter: 'a', text: 'Animado',         temperament: 'SANGUINEO' }, { letter: 'b', text: 'Aventurero',      temperament: 'COLERICO' }, { letter: 'c', text: 'Analítico',        temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Adaptable',       temperament: 'FLEMATICO' }] },
  { number: 2,  section: 'FORTALEZAS',  text: '2', options: [{ letter: 'a', text: 'Juguetón',        temperament: 'SANGUINEO' }, { letter: 'b', text: 'Persuasivo',      temperament: 'COLERICO' }, { letter: 'c', text: 'Persistente',      temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Plácido',         temperament: 'FLEMATICO' }] },
  { number: 3,  section: 'FORTALEZAS',  text: '3', options: [{ letter: 'a', text: 'Sociable',        temperament: 'SANGUINEO' }, { letter: 'b', text: 'Decidido',        temperament: 'COLERICO' }, { letter: 'c', text: 'Abnegado',         temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Sumiso',          temperament: 'FLEMATICO' }] },
  { number: 4,  section: 'FORTALEZAS',  text: '4', options: [{ letter: 'a', text: 'Convincente',     temperament: 'SANGUINEO' }, { letter: 'b', text: 'Controlado',      temperament: 'COLERICO' }, { letter: 'c', text: 'Competitivo',      temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Considerado',     temperament: 'FLEMATICO' }] },
  { number: 5,  section: 'FORTALEZAS',  text: '5', options: [{ letter: 'a', text: 'Entusiasta',      temperament: 'SANGUINEO' }, { letter: 'b', text: 'Inventivo',       temperament: 'COLERICO' }, { letter: 'c', text: 'Respetuoso',       temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Reservado',       temperament: 'FLEMATICO' }] },
  { number: 6,  section: 'FORTALEZAS',  text: '6', options: [{ letter: 'a', text: 'Enérgico',        temperament: 'SANGUINEO' }, { letter: 'b', text: 'Autosuficiente',  temperament: 'COLERICO' }, { letter: 'c', text: 'Sensible',         temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Contento',        temperament: 'FLEMATICO' }] },
  { number: 7,  section: 'FORTALEZAS',  text: '7', options: [{ letter: 'a', text: 'Activista',       temperament: 'SANGUINEO' }, { letter: 'b', text: 'Positivo',        temperament: 'COLERICO' }, { letter: 'c', text: 'Planificador',     temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Paciente',        temperament: 'FLEMATICO' }] },
  { number: 8,  section: 'FORTALEZAS',  text: '8', options: [{ letter: 'a', text: 'Espontáneo',      temperament: 'SANGUINEO' }, { letter: 'b', text: 'Seguro',          temperament: 'COLERICO' }, { letter: 'c', text: 'Puntual',          temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Tímido',          temperament: 'FLEMATICO' }] },
  { number: 9,  section: 'FORTALEZAS',  text: '9', options: [{ letter: 'a', text: 'Optimista',       temperament: 'SANGUINEO' }, { letter: 'b', text: 'Abierto',         temperament: 'COLERICO' }, { letter: 'c', text: 'Ordenado',         temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Atento',          temperament: 'FLEMATICO' }] },
  { number: 10, section: 'FORTALEZAS',  text: '10', options: [{ letter: 'a', text: 'Humorístico',    temperament: 'SANGUINEO' }, { letter: 'b', text: 'Dominante',       temperament: 'COLERICO' }, { letter: 'c', text: 'Fiel',             temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Amigable',        temperament: 'FLEMATICO' }] },
  { number: 11, section: 'FORTALEZAS',  text: '11', options: [{ letter: 'a', text: 'Encantador',     temperament: 'SANGUINEO' }, { letter: 'b', text: 'Osado',           temperament: 'COLERICO' }, { letter: 'c', text: 'Detallista',       temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Diplomático',     temperament: 'FLEMATICO' }] },
  { number: 12, section: 'FORTALEZAS',  text: '12', options: [{ letter: 'a', text: 'Alegre',         temperament: 'SANGUINEO' }, { letter: 'b', text: 'Constante',       temperament: 'COLERICO' }, { letter: 'c', text: 'Culto',            temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Confiado',        temperament: 'FLEMATICO' }] },
  { number: 13, section: 'FORTALEZAS',  text: '13', options: [{ letter: 'a', text: 'Inspirador',     temperament: 'SANGUINEO' }, { letter: 'b', text: 'Independiente',   temperament: 'COLERICO' }, { letter: 'c', text: 'Idealista',        temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Inofensivo',      temperament: 'FLEMATICO' }] },
  { number: 14, section: 'FORTALEZAS',  text: '14', options: [{ letter: 'a', text: 'Cálido',         temperament: 'SANGUINEO' }, { letter: 'b', text: 'Decisivo',        temperament: 'COLERICO' }, { letter: 'c', text: 'Humor Seco',       temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Introspectivo',   temperament: 'FLEMATICO' }] },
  { number: 15, section: 'FORTALEZAS',  text: '15', options: [{ letter: 'a', text: 'Cordial',        temperament: 'SANGUINEO' }, { letter: 'b', text: 'Instigador',      temperament: 'COLERICO' }, { letter: 'c', text: 'Considerada',      temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Conciliador',     temperament: 'FLEMATICO' }] },
  { number: 16, section: 'FORTALEZAS',  text: '16', options: [{ letter: 'a', text: 'Platicador',     temperament: 'SANGUINEO' }, { letter: 'b', text: 'Tenaz',           temperament: 'COLERICO' }, { letter: 'c', text: 'Considerado',      temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Tolerante',       temperament: 'FLEMATICO' }] },
  { number: 17, section: 'FORTALEZAS',  text: '17', options: [{ letter: 'a', text: 'Vivaz',          temperament: 'SANGUINEO' }, { letter: 'b', text: 'Líder',           temperament: 'COLERICO' }, { letter: 'c', text: 'Leal',             temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Escucha',         temperament: 'FLEMATICO' }] },
  { number: 18, section: 'FORTALEZAS',  text: '18', options: [{ letter: 'a', text: 'Listo',          temperament: 'SANGUINEO' }, { letter: 'b', text: 'Jefe',            temperament: 'COLERICO' }, { letter: 'c', text: 'Organizado',       temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Contento',        temperament: 'FLEMATICO' }] },
  { number: 19, section: 'FORTALEZAS',  text: '19', options: [{ letter: 'a', text: 'Popular',        temperament: 'SANGUINEO' }, { letter: 'b', text: 'Productivo',      temperament: 'COLERICO' }, { letter: 'c', text: 'Perfeccionista',   temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Permisivo',       temperament: 'FLEMATICO' }] },
  { number: 20, section: 'FORTALEZAS',  text: '20', options: [{ letter: 'a', text: 'Jovial',         temperament: 'SANGUINEO' }, { letter: 'b', text: 'Atrevido',        temperament: 'COLERICO' }, { letter: 'c', text: 'Se comporta bien', temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Equilibrado',     temperament: 'FLEMATICO' }] },
  { number: 21, section: 'DEBILIDADES', text: '21', options: [{ letter: 'a', text: 'Estridente',     temperament: 'SANGUINEO' }, { letter: 'b', text: 'Mandón',          temperament: 'COLERICO' }, { letter: 'c', text: 'Apocado',          temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Soso',            temperament: 'FLEMATICO' }] },
  { number: 22, section: 'DEBILIDADES', text: '22', options: [{ letter: 'a', text: 'Indisciplinado', temperament: 'SANGUINEO' }, { letter: 'b', text: 'Antipático',      temperament: 'COLERICO' }, { letter: 'c', text: 'Sin entusiasmo',   temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Implacable',      temperament: 'FLEMATICO' }] },
  { number: 23, section: 'DEBILIDADES', text: '23', options: [{ letter: 'a', text: 'Repetidor',      temperament: 'SANGUINEO' }, { letter: 'b', text: 'Reticente',       temperament: 'COLERICO' }, { letter: 'c', text: 'Resentido',        temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Resistente',      temperament: 'FLEMATICO' }] },
  { number: 24, section: 'DEBILIDADES', text: '24', options: [{ letter: 'a', text: 'Olvidadizo',     temperament: 'SANGUINEO' }, { letter: 'b', text: 'Franco',          temperament: 'COLERICO' }, { letter: 'c', text: 'Exigente',         temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Temeroso',        temperament: 'FLEMATICO' }] },
  { number: 25, section: 'DEBILIDADES', text: '25', options: [{ letter: 'a', text: 'Interrumpe',     temperament: 'SANGUINEO' }, { letter: 'b', text: 'Impaciente',      temperament: 'COLERICO' }, { letter: 'c', text: 'Inseguro',         temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Indeciso',        temperament: 'FLEMATICO' }] },
  { number: 26, section: 'DEBILIDADES', text: '26', options: [{ letter: 'a', text: 'Imprevisible',   temperament: 'SANGUINEO' }, { letter: 'b', text: 'Frío',            temperament: 'COLERICO' }, { letter: 'c', text: 'No compromete',    temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Impopular',       temperament: 'FLEMATICO' }] },
  { number: 27, section: 'DEBILIDADES', text: '27', options: [{ letter: 'a', text: 'Descuidado',     temperament: 'SANGUINEO' }, { letter: 'b', text: 'Terco',           temperament: 'COLERICO' }, { letter: 'c', text: 'Difícil de contentar', temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Vacilante',      temperament: 'FLEMATICO' }] },
  { number: 28, section: 'DEBILIDADES', text: '28', options: [{ letter: 'a', text: 'Tolerante',      temperament: 'SANGUINEO' }, { letter: 'b', text: 'Orgulloso',       temperament: 'COLERICO' }, { letter: 'c', text: 'Pesimista',        temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Insípido',        temperament: 'FLEMATICO' }] },
  { number: 29, section: 'DEBILIDADES', text: '29', options: [{ letter: 'a', text: 'Iracundo',       temperament: 'SANGUINEO' }, { letter: 'b', text: 'Argumentador',    temperament: 'COLERICO' }, { letter: 'c', text: 'Sin motivación',   temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Taciturno',       temperament: 'FLEMATICO' }] },
  { number: 30, section: 'DEBILIDADES', text: '30', options: [{ letter: 'a', text: 'Ingenuo',        temperament: 'SANGUINEO' }, { letter: 'b', text: 'Nervioso',        temperament: 'COLERICO' }, { letter: 'c', text: 'Negativo',         temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Desprendido',     temperament: 'FLEMATICO' }] },
  { number: 31, section: 'DEBILIDADES', text: '31', options: [{ letter: 'a', text: 'Egocéntrico',    temperament: 'SANGUINEO' }, { letter: 'b', text: 'Adicto al trabajo', temperament: 'COLERICO' }, { letter: 'c', text: 'Abstraído',       temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Ansioso',         temperament: 'FLEMATICO' }] },
  { number: 32, section: 'DEBILIDADES', text: '32', options: [{ letter: 'a', text: 'Hablador',       temperament: 'SANGUINEO' }, { letter: 'b', text: 'Indiscreto',      temperament: 'COLERICO' }, { letter: 'c', text: 'Susceptible',      temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Tímido',          temperament: 'FLEMATICO' }] },
  { number: 33, section: 'DEBILIDADES', text: '33', options: [{ letter: 'a', text: 'Desorganizado',  temperament: 'SANGUINEO' }, { letter: 'b', text: 'Dominante',       temperament: 'COLERICO' }, { letter: 'c', text: 'Deprimido',        temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Dudoso',          temperament: 'FLEMATICO' }] },
  { number: 34, section: 'DEBILIDADES', text: '34', options: [{ letter: 'a', text: 'Inconsistente',  temperament: 'SANGUINEO' }, { letter: 'b', text: 'Intolerante',     temperament: 'COLERICO' }, { letter: 'c', text: 'Introvertido',     temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Indiferente',     temperament: 'FLEMATICO' }] },
  { number: 35, section: 'DEBILIDADES', text: '35', options: [{ letter: 'a', text: 'Desordenado',    temperament: 'SANGUINEO' }, { letter: 'b', text: 'Manipulador',     temperament: 'COLERICO' }, { letter: 'c', text: 'Moroso',           temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Quejumbroso',     temperament: 'FLEMATICO' }] },
  { number: 36, section: 'DEBILIDADES', text: '36', options: [{ letter: 'a', text: 'Ostentoso',      temperament: 'SANGUINEO' }, { letter: 'b', text: 'Testarudo',       temperament: 'COLERICO' }, { letter: 'c', text: 'Escéptico',        temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Lento',           temperament: 'FLEMATICO' }] },
  { number: 37, section: 'DEBILIDADES', text: '37', options: [{ letter: 'a', text: 'Emocional',      temperament: 'SANGUINEO' }, { letter: 'b', text: 'Prepotente',      temperament: 'COLERICO' }, { letter: 'c', text: 'Solitario',        temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Perezoso',        temperament: 'FLEMATICO' }] },
  { number: 38, section: 'DEBILIDADES', text: '38', options: [{ letter: 'a', text: 'Atolondrado',    temperament: 'SANGUINEO' }, { letter: 'b', text: 'Malgeniado',      temperament: 'COLERICO' }, { letter: 'c', text: 'Suspicaz',         temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Sin ambición',    temperament: 'FLEMATICO' }] },
  { number: 39, section: 'DEBILIDADES', text: '39', options: [{ letter: 'a', text: 'Inquieto',       temperament: 'SANGUINEO' }, { letter: 'b', text: 'Precipitado',     temperament: 'COLERICO' }, { letter: 'c', text: 'Vengativo',        temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Poca Voluntad',   temperament: 'FLEMATICO' }] },
  { number: 40, section: 'DEBILIDADES', text: '40', options: [{ letter: 'a', text: 'Variable',       temperament: 'SANGUINEO' }, { letter: 'b', text: 'Crítico',         temperament: 'COLERICO' }, { letter: 'c', text: 'Comprometido',     temperament: 'MELANCOLICO' }, { letter: 'd', text: 'Astuto',          temperament: 'FLEMATICO' }] },
];

const insertOption = db.prepare(`
  INSERT INTO options (question_id, letter, text, temperament)
  VALUES (?, ?, ?, ?)
`);

const existingQuestions = db.prepare(`SELECT id FROM questions WHERE test_id = ?`).all(test.id);
if (existingQuestions.length !== 40) {
  db.prepare(`DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE test_id = ?)`).run(test.id);
  db.prepare(`DELETE FROM questions WHERE test_id = ?`).run(test.id);
  for (const q of questionsData) {
    const result = db.prepare(`INSERT INTO questions (test_id, number, section, text, active) VALUES (?, ?, ?, ?, 1)`).run(test.id, q.number, q.section, q.text);
    for (const opt of q.options) {
      insertOption.run(result.lastInsertRowid, opt.letter, opt.text, opt.temperament);
    }
  }
} else {
  for (const q of questionsData) {
    const existing = db.prepare(`SELECT id FROM questions WHERE test_id = ? AND number = ?`).get(test.id, q.number);
    if (existing) {
      db.prepare(`UPDATE questions SET text = ?, section = ? WHERE id = ?`).run(q.text, q.section, existing.id);
      db.prepare(`DELETE FROM options WHERE question_id = ?`).run(existing.id);
      for (const opt of q.options) {
        insertOption.run(existing.id, opt.letter, opt.text, opt.temperament);
      }
    }
  }
}
console.log('40 preguntas y opciones del Test de Personalidad creadas/verificadas.');

const licenseKey = 'DEI-' + uuidv4().toUpperCase().replace(/-/g, '').substring(0, 16);
const insertLicense = db.prepare(`
  INSERT OR IGNORE INTO license_keys (key_value, entity_id, valid_from, valid_to, status)
  VALUES (?, ?, ?, ?, 'activa')
`);
insertLicense.run(licenseKey, entity.id, '2026-05-04', '2026-05-06');
const license = db.prepare(`SELECT id FROM license_keys WHERE key_value = ?`).get(licenseKey);

const insertEvent = db.prepare(`
  INSERT OR IGNORE INTO events (entity_id, test_id, name, start_date, end_date, active, license_key_id)
  VALUES (?, ?, ?, ?, ?, 1, ?)
`);
insertEvent.run(entity.id, test.id, 'Test de Personalidad - Mayo 2026', '2026-05-04', '2026-05-06', license.id);
const event = db.prepare(`SELECT id FROM events WHERE name = 'Test de Personalidad - Mayo 2026'`).get();

db.prepare(`UPDATE license_keys SET event_id = ? WHERE id = ?`).run(event.id, license.id);

const insertEventUser = db.prepare(`INSERT OR IGNORE INTO event_users (event_id, user_id) VALUES (?, ?)`);
insertEventUser.run(event.id, adminUser.id);

console.log('Evento creado/verificado, id:', event.id);
console.log('License key generada:', licenseKey);
console.log('');
console.log('=== SEED COMPLETADO ===');
console.log('Usuario: mikenoecarcamo@gmail.com');
console.log('Contraseña temporal: 123456789');
console.log('(El usuario debe cambiar la contraseña al primer inicio de sesión)');
console.log('License Key del evento:', licenseKey);
