require('dotenv').config();
const db = require('./database');

console.log('Ejecutando migración Burnout...');

const cols = db.pragma('table_info(tests)').map(c => c.name);
if (!cols.includes('test_type')) {
  db.exec(`ALTER TABLE tests ADD COLUMN test_type TEXT NOT NULL DEFAULT 'TEMPERAMENTO'`);
  console.log('Columna test_type agregada a tests');
}

const qcols = db.pragma('table_info(questions)').map(c => c.name);
try {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id),
      number INTEGER NOT NULL,
      section TEXT,
      text TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    INSERT OR IGNORE INTO questions_new SELECT id, test_id, number, section, text, active FROM questions;
    DROP TABLE questions;
    ALTER TABLE questions_new RENAME TO questions;
  `);
  db.pragma('foreign_keys = ON');
  console.log('Tabla questions actualizada: section ahora es nullable');
} catch (e) {
  db.pragma('foreign_keys = ON');
  console.log('questions migration skipped:', e.message);
}

const rcols = db.pragma('table_info(responses)').map(c => c.name);
if (!rcols.includes('burnout_ce')) {
  db.exec(`ALTER TABLE responses ADD COLUMN burnout_ce INTEGER`);
  db.exec(`ALTER TABLE responses ADD COLUMN burnout_dp INTEGER`);
  db.exec(`ALTER TABLE responses ADD COLUMN burnout_rp INTEGER`);
  db.exec(`ALTER TABLE responses ADD COLUMN burnout_ce_nivel TEXT`);
  db.exec(`ALTER TABLE responses ADD COLUMN burnout_dp_nivel TEXT`);
  db.exec(`ALTER TABLE responses ADD COLUMN burnout_rp_nivel TEXT`);
  db.exec(`ALTER TABLE responses ADD COLUMN burnout_diagnostico TEXT`);
  console.log('Columnas Burnout agregadas a responses');
}

const racols = db.pragma('table_info(response_answers)').map(c => c.name);
if (!racols.includes('numeric_value')) {
  db.exec(`ALTER TABLE response_answers ADD COLUMN numeric_value INTEGER`);
  console.log('Columna numeric_value agregada a response_answers');
}

console.log('Migración Burnout completada.');
